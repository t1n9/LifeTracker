# 数据库备份事无巨细

## 📖 概述

本文档详细说明了当前 PostgreSQL 数据库的自动备份策略、手动备份方法以及数据恢复流程。系统使用 `pgBackRest` 作为备份工具，提供企业级的备份和点-in-time恢复能力。

------

## ⚙️ 系统配置详情

### 备份环境

- **PostgreSQL 版本**: 12.22
- **备份工具**: pgBackRest 2.24
- **数据目录**: `/var/lib/postgresql/12/main/`
- **备份仓库**: `/var/lib/pgbackrest/`
- **配置文件**: `/etc/pgbackrest.conf`

### 当前配置

ini

```
[global]
repo1-path = /var/lib/pgbackrest
repo1-retention-full = 2
log-level-file = detail

[main]
pg1-path = /var/lib/postgresql/12/main
```



------

## 🔄 自动备份规则

### 定时任务设置

备份任务通过 root 用户的 crontab 自动执行：

bash

```
# 每天中午12点更新SSL证书
0 12 * * * /usr/bin/certbot renew --quiet

# 每周日凌晨2点全量备份
0 2 * * 0 sudo -u postgres /usr/bin/pgbackrest --type=full --stanza=main backup

# 周一到周六凌晨3点差异备份  
0 3 * * 1-6 sudo -u postgres /usr/bin/pgbackrest --type=diff --stanza=main backup
```



### 备份保留策略

- **保留2个完整备份**：自动清理旧的备份文件
- **WAL持续归档**：支持任意时间点恢复
- **自动空间管理**：无需手动清理旧备份

------

## 🛠️ 手动备份操作

### 1. 执行全量备份

bash

```
sudo -u postgres pgbackrest --type=full --stanza=main --log-level-console=info backup
```



### 2. 执行差异备份

bash

```
sudo -u postgres pgbackrest --type=diff --stanza=main --log-level-console=info backup
```



### 3. 执行增量备份

bash

```
sudo -u postgres pgbackrest --type=incr --stanza=main --log-level-console=info backup
```



### 4. 立即归档当前WAL

bash

```
sudo -u postgres psql -c "SELECT pg_switch_wal();"
```



------

## 📊 备份管理命令

### 查看备份状态

bash

```
# 查看所有备份信息
sudo -u postgres pgbackrest --stanza=main info

# 详细格式查看
sudo -u postgres pgbackrest --stanza=main --output=json info
```



### 检查备份完整性

bash

```
sudo -u postgres pgbackrest --stanza=main --log-level-console=info check
```



### 验证归档状态

bash

```
sudo -u postgres pgbackrest --stanza=main --log-level-console=info archive-check
```



------

## 🚨 数据恢复操作

### 场景1：完整恢复到最后备份状态

bash

```
# 停止数据库
sudo systemctl stop postgresql

# 执行恢复（delta模式会先清理数据目录）
sudo -u postgres pgbackrest --stanza=main --delta --log-level-console=info restore

# 启动数据库
sudo systemctl start postgresql
```



### 场景2：恢复到特定时间点（PITR）

bash

```
# 停止数据库
sudo systemctl stop postgresql

# 恢复到指定时间
sudo -u postgres pgbackrest --stanza=main --delta \
    --type=time --target="2025-09-15 20:00:00" \
    --log-level-console=info restore

# 启动数据库  
sudo systemctl start postgresql
```



### 场景3：恢复到特定备份集

bash

```
# 停止数据库
sudo systemctl stop postgresql

# 恢复到特定备份（先查看info获取备份标签）
sudo -u postgres pgbackrest --stanza=main --delta \
    --set=20250916-004843F \
    --log-level-console=info restore

# 启动数据库
sudo systemctl start postgresql
```



### 场景4：测试恢复（不影响生产环境）

bash

```
# 恢复到测试目录
sudo mkdir -p /tmp/test_recovery
sudo chown postgres:postgres /tmp/test_recovery

sudo -u postgres pgbackrest --stanza=main --delta \
    --pg1-path=/tmp/test_recovery \
    --log-level-console=info restore
```



------

## 🔍 故障排查命令

### 查看备份日志

bash

```
# 查看最新备份日志
sudo tail -f /var/log/pgbackrest/main-backup.log

# 查看所有日志文件
sudo ls -la /var/log/pgbackrest/
```



### 检查系统状态

bash

```
# 检查归档状态
sudo -u postgres psql -c "SELECT * FROM pg_stat_archiver;"

# 检查WAL归档情况
sudo -u postgres psql -c "SELECT * FROM pg_ls_waldir();"
```



### 验证配置

bash

```
# 检查运行中的归档配置
sudo -u postgres psql -c "SHOW archive_mode;"
sudo -u postgres psql -c "SHOW archive_command;"
```



------

## 📋 日常维护 checklist

### 每日检查

- 确认定时备份任务正常运行
- 检查备份日志无错误信息
- 验证磁盘空间充足

### 每周检查

- 确认全量备份成功完成
- 检查备份保留策略正确执行
- 验证恢复测试（可选）

### 每月检查

- 执行完整的恢复演练测试
- 检查备份性能和数据增长情况
- 审核备份策略是否满足业务需求

------

## ⚠️ 重要注意事项

1. **权限要求**：所有备份恢复操作需要 postgres 用户权限
2. **空间监控**：确保备份仓库有足够磁盘空间
3. **恢复测试**：定期测试恢复流程确保备份有效
4. **监控告警**：设置备份失败的监控告警
5. **文档更新**：任何配置变更后更新本文档

------

## 🆘 紧急联系人

如遇备份恢复问题，请依次尝试：

1. 查看本文档故障排查章节
2. 检查 `/var/log/pgbackrest/` 日志文件
3. 联系系统管理员

------

*文档最后更新: 2025年9月16日*
*备份系统版本: pgBackRest 2.24*