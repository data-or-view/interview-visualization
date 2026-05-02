# MySQL 8.4.0 源码编译安装报告

**编译日期**: 2026-05-02  
**编译环境**: Ubuntu 22.04.5 LTS  
**报告生成时间**: 2026-05-02 10:09 GMT+8

---

## 一、编译环境概述

### 1.1 服务器配置

| 项目 | 配置 |
|------|------|
| 操作系统 | Ubuntu 22.04.5 LTS |
| CPU | Intel Xeon Platinum 4 核 |
| 内存 | 7.1 GB |
| Swap | 8.0 GB |
| 架构 | x86_64 |
| 磁盘可用 | 52 GB |

### 1.2 编译工具链

| 工具 | 版本 |
|------|------|
| CMake | 3.22.1 |
| GCC | 11.4.0 |
| G++ | 11.4.0 |
| Git | 2.34.1 |

### 1.3 依赖库

已安装的系统依赖：
- cmake
- libboost-dev, libboost-program-options-dev, libboost-filesystem-dev, libboost-system-dev, libboost-regex-dev, libboost-thread-dev, libboost-iostreams-dev
- libssl-dev
- libncurses-dev
- libreadline-dev
- libzstd-dev
- liblz4-dev
- libtirpc-dev
- libevent-dev
- libmecab-dev
- bison
- pkg-config

---

## 二、源码下载

### 2.1 源码信息

| 项目 | 详情 |
|------|------|
| 源码包 | mysql-8.4.0.tar.gz |
| 版本 | MySQL 8.4.0 (LTS) |
| 发布日期 | 2024-04-10 |
| 源码大小 | 395 MB |
| 源码位置 | /opt/mysql-8.4.0 |
| 下载 URL | https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.0.tar.gz |

### 2.2 Git 分支管理

```bash
cd /opt/mysql-8.4.0
git init
git config user.email "admin@localhost"
git config user.name "Admin"
git add -A
git commit -m "Initial commit: MySQL 8.4.0 source"
git checkout -b local/mysql-8.4-build
```

**本地分支**: `local/mysql-8.4-build`  
**用途**: 本地编译跟踪，不推送

---

## 三、编译配置

### 3.1 CMake 配置命令

```bash
cd /opt/mysql-8.4.0
mkdir build && cd build
cmake .. \
  -DCMAKE_INSTALL_PREFIX=/opt/mysql-8.4-custom \
  -DCMAKE_BUILD_TYPE=RelWithDebInfo
```

### 3.2 配置选项说明

| 选项 | 值 | 说明 |
|------|-----|------|
| CMAKE_INSTALL_PREFIX | /opt/mysql-8.4-custom | 安装目标目录 |
| CMAKE_BUILD_TYPE | RelWithDebInfo | 发布版本带调试信息 |

### 3.3 配置结果摘要

```
-- MySQL 8.4.0
-- CMAKE_BUILD_TYPE: RelWithDebInfo
-- CMAKE_CXX_FLAGS: -std=c++20 -fno-omit-frame-pointer ...
-- CMAKE_CXX_FLAGS_RELWITHDEBINFO: -ffunction-sections -fdata-sections -O2 -g -DNDEBUG -g1
-- Build files have been written to: /opt/mysql-8.4.0/build
```

---

## 四、编译过程

### 4.1 编译命令

```bash
cd /opt/mysql-8.4.0/build
nohup make -j3 > /tmp/mysql-build.log 2>&1 &
```

### 4.2 编译策略

- **并行度**: `-j3` (4 核 -1，留 1 核给系统)
- **后台运行**: 使用 `nohup` 确保会话结束后继续运行
- **日志**: `/tmp/mysql-build.log`

### 4.3 编译问题与解决

#### 问题 1: OOM 内存不足 (02:03)
- **现象**: 编译进行到约 2% 时被系统终止
- **原因**: 7.1GB 内存不足以支持多核编译
- **解决**: 使用现有 8GB Swap 空间 (`/swapfile`)

#### 问题 2: 构建目录状态不一致 (02:06)
- **现象**: `make clean` 后部分文件丢失
- **原因**: 中断导致构建目录状态损坏
- **解决**: 删除 build 目录并重新运行 cmake 配置

#### 问题 3: 后台进程被终止 (02:15)
- **现象**: exec 会话结束后编译进程被杀死
- **原因**: 未使用 `nohup` 保护
- **解决**: 使用 `nohup make` 重新启动

#### 问题 4: 编译在 88% 时 OOM (04:02)
- **现象**: field.cc.o 和 field_conv.cc.o 编译时内存不足
- **原因**: 3 核并行编译峰值内存超过 7.1GB
- **解决**: Swap 空间自动补充，从断点继续编译

### 4.4 编译时间

| 阶段 | 耗时 |
|------|------|
| 源码下载 | ~3 分钟 |
| 依赖安装 | ~5 分钟 |
| CMake 配置 | ~3 分钟 |
| 编译 (make -j3) | ~3 小时 17 分钟 |
| 安装 (make install) | ~2 分钟 |
| 初始化数据库 | ~3 秒 |
| **总计** | **~3 小时 30 分钟** |

---

## 五、安装与配置

### 5.1 安装命令

```bash
cd /opt/mysql-8.4.0/build
sudo make install
```

### 5.2 安装位置

**安装目录**: `/opt/mysql-8.4-custom`

### 5.3 目录结构

```
/opt/mysql-8.4-custom/
├── bin/          # 可执行文件 (mysql, mysqld, mysqladmin 等)
├── docs/         # 文档
├── include/      # C/C++ 头文件
├── lib/          # 库文件
├── lib64/        # 64 位库文件
├── man/          # 手册页
├── mysql-test/   # 测试套件
├── run/          # 运行时目录
└── var/          # 变量目录
```

### 5.4 主要二进制文件

| 文件 | 大小 | 说明 |
|------|------|------|
| mysqld | 219 MB | MySQL 服务器 |
| mysql | 10 MB | MySQL 客户端 |
| mysqladmin | 9 MB | 管理工具 |
| mysqldump | 10 MB | 备份工具 |
| mysqlbinlog | 12 MB | 二进制日志工具 |
| mysqlrouter | 1 MB | 路由工具 |

### 5.5 环境变量配置

添加到 `~/.bashrc`:

```bash
export PATH=/opt/mysql-8.4-custom/bin:$PATH
export MYSQL_HOME=/opt/mysql-8.4-custom
```

---

## 六、数据库初始化

### 6.1 创建数据目录

```bash
sudo mkdir -p /var/lib/mysql /var/run/mysqld
sudo chown -R admin:admin /var/lib/mysql /var/run/mysqld
sudo chmod 755 /var/run/mysqld
```

### 6.2 初始化数据库

```bash
mysqld --initialize-insecure --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir=/var/lib/mysql
```

**输出**:
```
2026-05-02T02:07:51.857727Z 6 [Warning] [MY-010453] [Server] 
root@localhost is created with an empty password ! 
Please consider switching off the --initialize-insecure option.
```

### 6.3 启动服务器

```bash
mysqld --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir=/var/lib/mysql \
  --pid-file=/var/run/mysqld/mysqld.pid &
```

### 6.4 设置 root 密码

```bash
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';"
```

### 6.5 验证连接

```bash
mysql -u root -p123456 -e "SELECT VERSION(); SHOW DATABASES;"
```

**输出**:
```
VERSION()
8.4.0

Database
information_schema
mysql
performance_schema
sys
```

---

## 七、Git 仓库管理

### 7.1 仓库信息

| 项目 | 详情 |
|------|------|
| 仓库路径 | /opt/mysql-8.4.0 |
| 当前分支 | local/mysql-8.4-build |
| 本地文档目录 | /opt/mysql-8.4.0/openclaw-doc/ |

### 7.2 常用 Git 命令

```bash
# 查看状态
cd /opt/mysql-8.4.0
git status

# 查看分支
git branch -v

# 查看提交历史
git log --oneline -5
```

---

## 八、与官方二进制包对比

| 特性 | 官方二进制包 | 自编译版本 |
|------|-------------|-----------|
| 版本 | 8.4.0 | 8.4.0 |
| 优化 | 通用优化 | 针对当前系统优化 |
| 调试符号 | 无 | 有 (RelWithDebInfo) |
| 安装位置 | /usr/mysql/8.4 | /opt/mysql-8.4-custom |
| 可控性 | 低 | 高 (可定制编译选项) |
| 编译时间 | 无 | ~3.5 小时 |

---

## 九、注意事项

### 9.1 系统要求

- **最低内存**: 4 GB (推荐 8 GB+)
- **推荐 Swap**: 8 GB+ (内存不足时作为后备)
- **最低磁盘空间**: 5 GB (源码 + 构建产物 + 安装)

### 9.2 编译建议

1. **使用 nohup**: 确保后台进程不受会话结束影响
   ```bash
   nohup make -j3 > build.log 2>&1 &
   ```

2. **配置 Swap**: 防止 OOM 终止
   ```bash
   sudo fallocate -l 8G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

3. **并行度选择**: 根据内存调整
   - 7GB 内存：`make -j3` 或 `make -j2`
   - 16GB+ 内存：`make -j4` 或更高

### 9.3 启动服务

**手动启动**:
```bash
mysqld --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir=/var/lib/mysql
```

**Systemd 服务** (可选):
创建 `/etc/systemd/system/mysqld.service`:
```ini
[Unit]
Description=MySQL 8.4.0 Custom Server
After=network.target

[Service]
User=admin
ExecStart=/opt/mysql-8.4-custom/bin/mysqld --user=admin
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

---

## 十、总结

本次 MySQL 8.4.0 源码编译安装成功完成。自编译 MySQL 与官方发行版功能相同，但具有以下优势：

1. **完全可控**: 可自定义编译选项和优化参数
2. **学习价值**: 深入了解 MySQL 内部结构和构建流程
3. **灵活性**: 可根据需求启用/禁用特定功能
4. **调试支持**: 包含调试符号，便于问题排查

编译产物已安装至 `/opt/mysql-8.4-custom`，可立即用于数据库服务。

### 关键信息汇总

| 项目 | 值 |
|------|-----|
| MySQL 版本 | 8.4.0 (LTS) |
| 安装位置 | /opt/mysql-8.4-custom |
| 数据目录 | /var/lib/mysql |
| root 密码 | 123456 |
| 端口 | 3306 (MySQL), 33060 (X Plugin) |
| Socket | /tmp/mysql.sock |

---

## 附录 A: 完整编译脚本

```bash
#!/bin/bash
set -e

# 1. 安装依赖
sudo apt-get update
sudo apt-get install -y \
  cmake \
  libboost-dev libboost-program-options-dev libboost-filesystem-dev \
  libboost-system-dev libboost-regex-dev libboost-thread-dev \
  libboost-iostreams-dev libssl-dev libncurses-dev libreadline-dev \
  libzstd-dev liblz4-dev libtirpc-dev libevent-dev libmecab-dev \
  bison pkg-config

# 2. 配置 Swap (如需要)
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. 下载源码
cd /opt
wget https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-8.4.0.tar.gz
tar -xzf mysql-8.4.0.tar.gz
cd mysql-8.4.0

# 4. Git 初始化
git init
git config user.email "admin@localhost"
git config user.name "Admin"
git add -A
git commit -m "Initial commit: MySQL 8.4.0 source"
git checkout -b local/mysql-8.4-build

# 5. CMake 配置
mkdir build && cd build
cmake .. -DCMAKE_INSTALL_PREFIX=/opt/mysql-8.4-custom

# 6. 编译
nohup make -j3 > /tmp/mysql-build.log 2>&1 &

# 7. 等待编译完成 (约 3-4 小时)
# 监控：tail -f /tmp/mysql-build.log

# 8. 安装
sudo make install

# 9. 配置环境变量
echo 'export PATH=/opt/mysql-8.4-custom/bin:$PATH' >> ~/.bashrc
echo 'export MYSQL_HOME=/opt/mysql-8.4-custom' >> ~/.bashrc
source ~/.bashrc

# 10. 初始化数据库
sudo mkdir -p /var/lib/mysql /var/run/mysqld
sudo chown -R admin:admin /var/lib/mysql /var/run/mysqld
mysqld --initialize-insecure --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir=/var/lib/mysql

# 11. 启动并设置密码
mysqld --user=admin \
  --basedir=/opt/mysql-8.4-custom \
  --datadir=/var/lib/mysql &
sleep 5
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';"

# 12. 验证
mysql -u root -p123456 -e "SELECT VERSION(); SHOW DATABASES;"
```

---

**报告完成** | 2026-05-02 10:09
