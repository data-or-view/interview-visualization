/* Copyright (c) 2026 MySQL Visualization Trace
 * trace_log.h — 可视化追踪日志宏
 *
 * 用法: mysqld --trace-file=/tmp/mysql-trace.jsonl
 * 输出格式: JSONL (每行一个 JSON 对象)
 *
 * TRACE_EVENT 在所有情况下都是安全的（编译期空操作检查）
 */

#ifndef TRACE_LOG_H
#define TRACE_LOG_H

#include <stdio.h>
#include <time.h>
#include <sys/time.h>

/* 全局 trace file path, 由 --trace-file 设定 */
extern char *opt_trace_file;

/* 获取毫秒时间戳 */
static inline long long trace_current_ms(void) {
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return (long long)tv.tv_sec * 1000 + (long long)tv.tv_usec / 1000;
}

/* JSON 字符串转义 */
static inline void trace_json_escape(FILE *fp, const char *s) {
  if (!s) { fputs("null", fp); return; }
  fputc('"', fp);
  for (; *s; s++) {
    switch (*s) {
      case '"':  fputs("\\\"", fp); break;
      case '\\': fputs("\\\\", fp); break;
      case '\n': fputs("\\n", fp);  break;
      case '\r': fputs("\\r", fp);  break;
      case '\t': fputs("\\t", fp);  break;
      default:   fputc(*s, fp);
    }
  }
  fputc('"', fp);
}

/* 线程安全：用文件追加模式 (fopen "a")，每次写一行后关闭 */
#define TRACE_EVENT(fmt, ...)                                         \
  do {                                                                \
    if (__builtin_expect(opt_trace_file != nullptr, 0)) {             \
      FILE *tf = fopen(opt_trace_file, "a");                          \
      if (tf) {                                                       \
        fprintf(tf, "{\"no\":\"mysql\",\"ts\":%lld" fmt,              \
                (long long)trace_current_ms(), ##__VA_ARGS__);        \
        fprintf(tf, "}\n");                                           \
        fclose(tf);                                                   \
      }                                                               \
    }                                                                 \
  } while (0)

/* 带 from/to 和 thread_id 的流式宏（前台线程） */
#define TRACE_EVENT_FLOW(cat, ev, from_comp, to_comp, tid, state, extra_fmt, ...) \
  TRACE_EVENT(",\"cat\":\"" cat "\",\"ev\":\"" ev "\""               \
              ",\"from\":\"" from_comp "\",\"to\":\"" to_comp "\""   \
              ",\"cid\":%d,\"ts_state\":\"" state "\""                \
              ",\"thr\":\"thread-per-conn\""                          \
              extra_fmt,                                               \
              tid, ##__VA_ARGS__)

/* 带 from/to + input 字段（前台线程，input 通过 json_escape 写入） */
#define TRACE_EVENT_FLOW_IN(cat, ev, from_comp, to_comp, tid, state, input_str) \
  do {                                                                 \
    if (__builtin_expect(opt_trace_file != nullptr, 0)) {              \
      FILE *tf_in = fopen(opt_trace_file, "a");                        \
      if (tf_in) {                                                     \
        fprintf(tf_in,                                                 \
                "{\"no\":\"mysql\",\"ts\":%lld"                        \
                ",\"cat\":\"" cat "\",\"ev\":\"" ev "\""               \
                ",\"from\":\"" from_comp "\",\"to\":\"" to_comp "\""   \
                ",\"cid\":%d,\"ts_state\":\"" state "\""               \
                ",\"thr\":\"thread-per-conn\""                         \
                ",\"input\":",                                         \
                (long long)trace_current_ms(), tid);                   \
        trace_json_escape(tf_in, input_str);                           \
        fprintf(tf_in, "}\n");                                         \
        fclose(tf_in);                                                 \
      }                                                                \
    }                                                                  \
  } while (0)

/* 带 from/to 的无 thread_id 版本（后台线程） */
#define TRACE_EVENT_FLOW_BG(cat, ev, from_comp, to_comp, state, extra_fmt, ...) \
  TRACE_EVENT(",\"cat\":\"" cat "\",\"ev\":\"" ev "\""               \
              ",\"from\":\"" from_comp "\",\"to\":\"" to_comp "\""   \
              ",\"ts_state\":\"" state "\""                           \
              extra_fmt,                                               \
              ##__VA_ARGS__)

/* 旧版兼容宏 */
#define TRACE_EVENT_EX(cat, ev, tid, state, extra_fmt, ...)           \
  TRACE_EVENT_FLOW(cat, ev, "unknown", "unknown", tid, state, extra_fmt, ##__VA_ARGS__)

#endif /* TRACE_LOG_H */
