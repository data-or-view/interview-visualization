#!/usr/bin/env python3
"""生成 MySQL 可视化合成 trace JSONL — 模拟典型事务+查询"""
import json, random, time

random.seed(20260505)
BASE_TS = 1777916506000

events = []
idx = 0
cid_counter = 0
xid_counter = 1000

def ev(evt, cat, extra=None, cid=None):
    global idx, cid_counter, xid_counter
    base = {"no":"mysql","ev":evt,"cat":cat,"idx":idx,"ts":int(BASE_TS + idx * 3),"dt":0,"thr":"thread-per-conn","ts_state":"","cid":cid}
    if extra:
        base.update(extra)
    # assign dt and ts_state
    dt_map = {
        'conn': {'recv': (5,30,'init'), 'cleaning': (2,10,'cleaning up')},
        'sql': {'parse': (20,120,'parsing'), 'optimize': (30,300,'optimizing')},
        'innodb': {'exec': (50,500,'executing'), 'page_read': (50,200,'reading from file'), 'commit': (5,20,'committing')},
        'undo': {'undo_write': (3,15,'Updating')},
        'redo': {'redo_prepare': (2,10,'flushing redo log'), 'redo_commit': (1,5,'flushing redo log')},
        'binlog': {'binlog_write': (3,15,'Writing to binlog'), 'binlog_read': (5,30,'Reading binlog')},
        'data': {'flush_dirty': (20,80,'flushing')},
        'lock': {'lock_wait': (100,2000,'Waiting for row lock')},
    }
    dm = dt_map.get(cat, {}).get(evt)
    if dm:
        base['dt'] = random.randint(dm[0], dm[1])
        base['ts_state'] = dm[2]
        base['ts'] = int(BASE_TS + idx * (3 + base['dt'] / 1000))
    base['idx'] = idx
    events.append(base)
    idx += 1
    return base

# ============= 合成数据：若干事务 + 只读查询 =============

# Session 1: 连接建立
cid = 1
ev('recv','conn', cid=cid)
ev('start','client',{'ts_state':'login'}, cid=cid)

# 事务 1: INSERT
ev('parse','sql',{'query':'INSERT INTO t1 VALUES(1,"hello")','ts_state':'parsing','table':'t1'}, cid=cid)
ev('optimize','sql',{'plan':'insert(t1)','ts_state':'optimizing','table':'t1'}, cid=cid)
xid = xid_counter; xid_counter += 1
ev('exec','innodb',{'rows':1,'table':'t1','xid':xid}, cid=cid)
ev('undo_write','undo',{'undo_no':1,'undo_type':'INSERT','table':'t1','xid':xid}, cid=cid)
ev('redo_prepare','redo',{'lsn':10000,'xid':xid}, cid=cid)
ev('binlog_write','binlog',{'xid':xid,'binlog_pos':100,'table':'t1'}, cid=cid)
ev('redo_commit','redo',{'lsn':10010,'xid':xid}, cid=cid)
ev('commit','innodb',{'xid':xid}, cid=cid)
ev('flush_dirty','data',{'page_no':101}, cid=cid)
ev('cleaning','conn',{}, cid=cid)

# Session 2: 事务 2 (UPDATE + 行锁)
cid = 2
ev('recv','conn', cid=cid)
ev('start','client',{'ts_state':'login'}, cid=cid)
ev('parse','sql',{'query':'UPDATE t1 SET val="world" WHERE id=1','ts_state':'parsing','table':'t1'}, cid=cid)
ev('optimize','sql',{'plan':'pk_scan(t1.id_idx)','ts_state':'optimizing','table':'t1'}, cid=cid)
xid = xid_counter; xid_counter += 1
ev('exec','innodb',{'rows':1,'table':'t1','xid':xid}, cid=cid)
ev('lock_wait','lock',{'lock_type':'X','waiting_for':'T1','table':'t1'}, cid=cid)
ev('undo_write','undo',{'undo_no':2,'undo_type':'UPDATE','table':'t1','xid':xid}, cid=cid)
ev('redo_prepare','redo',{'lsn':20000,'xid':xid}, cid=cid)
ev('binlog_write','binlog',{'xid':xid,'binlog_pos':200,'table':'t1'}, cid=cid)
ev('redo_commit','redo',{'lsn':20010,'xid':xid}, cid=cid)
ev('commit','innodb',{'xid':xid}, cid=cid)
ev('flush_dirty','data',{'page_no':102}, cid=cid)
ev('cleaning','conn',{}, cid=cid)

# Session 3: 只读查询 + 分页读
cid = 3
ev('recv','conn', cid=cid)
ev('start','client',{'ts_state':'login'}, cid=cid)
ev('parse','sql',{'query':'SELECT * FROM t1 WHERE id BETWEEN 1 AND 100','ts_state':'parsing','table':'t1'}, cid=cid)
ev('optimize','sql',{'plan':'range_scan(t1.id_idx)','ts_state':'optimizing','table':'t1'}, cid=cid)
ev('exec','innodb',{'rows':5,'table':'t1'}, cid=cid)
for _ in range(3):
    ev('page_read','innodb',{'page_no':random.randint(100,200),'table':'t1'}, cid=cid)
ev('cleaning','conn',{}, cid=cid)

# Session 4: 事务 3 (DELETE)
cid = 4
ev('recv','conn', cid=cid)
ev('start','client',{'ts_state':'login'}, cid=cid)
ev('parse','sql',{'query':'DELETE FROM t1 WHERE id=3','ts_state':'parsing','table':'t1'}, cid=cid)
ev('optimize','sql',{'plan':'pk_scan(t1)','ts_state':'optimizing','table':'t1'}, cid=cid)
xid = xid_counter; xid_counter += 1
ev('exec','innodb',{'rows':1,'table':'t1','xid':xid}, cid=cid)
ev('undo_write','undo',{'undo_no':3,'undo_type':'DELETE','table':'t1','xid':xid}, cid=cid)
ev('redo_prepare','redo',{'lsn':30000,'xid':xid}, cid=cid)
ev('binlog_write','binlog',{'xid':xid,'binlog_pos':300,'table':'t1'}, cid=cid)
ev('redo_commit','redo',{'lsn':30010,'xid':xid}, cid=cid)
ev('commit','innodb',{'xid':xid}, cid=cid)
ev('flush_dirty','data',{'page_no':105}, cid=cid)
ev('cleaning','conn',{}, cid=cid)

# Session 5: 复杂查询 + undo_read (MVCC)
cid = 5
ev('recv','conn', cid=cid)
ev('start','client',{'ts_state':'login'}, cid=cid)
ev('parse','sql',{'query':'SELECT * FROM t1 AS OF TIMESTAMP ...','ts_state':'parsing','table':'t1'}, cid=cid)
ev('optimize','sql',{'plan':'full_scan(t1)','ts_state':'optimizing','table':'t1'}, cid=cid)
ev('exec','innodb',{'rows':10,'table':'t1'}, cid=cid)
# MVCC 需要读 undo
ev('undo_read','undo',{'undo_no':1}, cid=cid)
ev('undo_read','undo',{'undo_no':2}, cid=cid)
for _ in range(2):
    ev('page_read','innodb',{'page_no':random.randint(100,200),'table':'t1'}, cid=cid)
ev('cleaning','conn',{}, cid=cid)

# 一些后台事件
ev('flush_dirty','data',{'page_no':200}, cid=None)
ev('flush_dirty','data',{'page_no':201}, cid=None)

# 再加一个事务以丰富数据
cid = 6
ev('recv','conn', cid=cid)
ev('start','client',{'ts_state':'login'}, cid=cid)
ev('parse','sql',{'query':'UPDATE t1 SET val="test" WHERE id=5','ts_state':'parsing','table':'t1'}, cid=cid)
ev('optimize','sql',{'plan':'pk_scan(t1)','ts_state':'optimizing','table':'t1'}, cid=cid)
xid = xid_counter; xid_counter += 1
ev('exec','innodb',{'rows':1,'table':'t1','xid':xid}, cid=cid)
ev('undo_write','undo',{'undo_no':4,'undo_type':'UPDATE','table':'t1','xid':xid}, cid=cid)
ev('redo_prepare','redo',{'lsn':40000,'xid':xid}, cid=cid)
ev('binlog_write','binlog',{'xid':xid,'binlog_pos':400,'table':'t1'}, cid=cid)
ev('redo_commit','redo',{'lsn':40010,'xid':xid}, cid=cid)
ev('commit','innodb',{'xid':xid}, cid=cid)
ev('flush_dirty','data',{'page_no':110}, cid=cid)
ev('cleaning','conn',{}, cid=cid)

# 输出
output_path = "/opt/mysql-8.4.0/openclaw-visualization/frontend/react-app/public/data/trace-mysql.jsonl"
with open(output_path, 'w') as f:
    for e in events:
        f.write(json.dumps(e, ensure_ascii=False) + '\n')

# 统计
from collections import Counter
cats = Counter(e['cat'] for e in events)
evs = Counter(e['ev'] for e in events)
print(f"Total: {len(events)} events")
print(f"Cats: {dict(cats)}")
print(f"Events: {dict(evs)}")
print(f"XID range: 1000-{xid_counter-1}")
