#!/bin/bash
# MySQL 埋点验证运行脚本
# 用法: bash openclaw-doc/trace/run-verification.sh

set -e

MYSQLD=/opt/mysql-8.4-custom/bin/mysqld
MYSQL=/opt/mysql-8.4-custom/bin/mysql
DATADIR=/opt/mysql-8.4-custom/data
TRACE_FILE=/tmp/mysql-trace.jsonl
MYCNF=/tmp/my-verify.cnf

echo "=== Step 1: 清理旧数据 ==="
rm -rf "$DATADIR" "$TRACE_FILE" "$MYCNF"

echo "=== Step 2: 初始化数据目录 ==="
"$MYSQLD" --initialize-insecure --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir="$DATADIR" \
  2>&1 | grep -v "Warning\|Insecure\|password\|\[Note\]"

echo "=== Step 3: 创建配置文件 ==="
cat > "$MYCNF" << 'EOF'
[mysqld]
basedir=/opt/mysql-8.4-custom
datadir=/opt/mysql-8.4-custom/data
socket=/tmp/mysql.sock
port=3306
user=admin
skip-grant-tables
innodb_flush_log_at_trx_commit=2
innodb_buffer_pool_size=64M
innodb_log_file_size=16M
innodb_io_capacity=200
EOF

echo "=== Step 4: 启动 MySQL ==="
"$MYSQLD" --defaults-file="$MYCNF" \
  --trace-file="$TRACE_FILE" \
  --daemonize \
  2>&1 | grep -v "Warning\|Insecure" || true

sleep 3

echo "=== Step 5: 检查 MySQL 是否运行 ==="
if ! "$MYSQL" -S /tmp/mysql.sock -u root -e "SELECT 1 AS ping" 2>/dev/null; then
  echo "ERROR: MySQL 未启动"
  cat "$DATADIR/$(hostname).err" 2>/dev/null | tail -20
  exit 1
fi

echo "=== Step 6: 执行 Session 1 测试 SQL ==="
"$MYSQL" -S /tmp/mysql.sock -u root < /tmp/mysql-comprehensive-test.sql 2>&1

echo "=== Step 7: Session 1 保持锁，用后台任务执行 Session 2 ==="
# Session 2 会因行锁阻塞；给 5 秒超时
timeout 5 "$MYSQL" -S /tmp/mysql.sock -u root < /tmp/mysql-session2-lock-test.sql 2>&1 || echo "(锁等待超时是预期的)"

# 提交 Session 1 的事务释放锁
"$MYSQL" -S /tmp/mysql.sock -u root -e "COMMIT; USE trace_test; INSERT INTO t_log (msg) VALUES ('Session1 release'); SELECT * FROM t_account;" 2>&1

echo "=== Step 8: 检查 trace 文件 ==="
if [ -f "$TRACE_FILE" ]; then
  LINES=$(wc -l < "$TRACE_FILE")
  echo "trace 文件: $TRACE_FILE ($LINES 行)"
  echo "--- 前 5 行 ---"
  head -5 "$TRACE_FILE"
  echo "--- 行数统计 ---"
  grep -o '"ev":"[^"]*"' "$TRACE_FILE" | sort | uniq -c | sort -rn
else
  echo "WARNING: trace 文件不存在！"
fi

echo "=== Step 9: 停止 MySQL ==="
"$MYSQL" -S /tmp/mysql.sock -u root -e "SHUTDOWN;" 2>/dev/null || true
sleep 2

echo ""
echo "=== 验证完成 ==="
echo "Trace 文件: $TRACE_FILE"
echo "Trace 行数: $(wc -l < "$TRACE_FILE")"
