# 🔧 Swap Space Setup Guide for 2GB RAM Servers

> **为资源受限的服务器增加交换空间，提高 Docker 构建稳定性**

---

## 📋 什么是交换空间（Swap）？

交换空间是硬盘上的一块区域，当物理内存（RAM）不足时，系统会将不常用的内存数据临时存储到交换空间中。

**为什么需要**：
- 2GB RAM 服务器在构建 Docker 镜像时可能内存不足
- npm install 和 TypeScript 编译都很消耗内存
- 交换空间可以防止进程因内存不足被杀死（OOM Kill）

---

## 🚀 一键设置（推荐）

### 创建 2GB 交换空间

```bash
# 1. 创建 2GB 交换文件
sudo fallocate -l 2G /swapfile

# 2. 设置正确的权限（安全要求）
sudo chmod 600 /swapfile

# 3. 格式化为交换空间
sudo mkswap /swapfile

# 4. 启用交换空间
sudo swapon /swapfile

# 5. 验证交换空间已启用
free -h
```

**预期输出**：
```
              total        used        free      shared  buff/cache   available
Mem:           1.9Gi       500Mi       1.0Gi       1.0Mi       400Mi       1.3Gi
Swap:          2.0Gi          0B       2.0Gi  ← 应该看到 2GB 交换空间
```

---

## 🔄 设置开机自动启用

如果你希望服务器重启后自动启用交换空间：

```bash
# 备份 fstab
sudo cp /etc/fstab /etc/fstab.backup

# 添加交换空间配置到 fstab
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 验证配置
cat /etc/fstab | grep swapfile
```

---

## 📊 检查和管理交换空间

### 查看当前交换空间状态
```bash
# 方法1：简单查看
free -h

# 方法2：详细信息
swapon --show

# 方法3：查看交换空间使用情况
cat /proc/swaps
```

### 查看交换空间使用率
```bash
# 实时监控内存和交换空间
watch -n 2 free -h
```

### 调整交换空间使用倾向（可选）
```bash
# 查看当前 swappiness 值（默认 60）
cat /proc/sys/vm/swappiness

# 临时调整（重启后失效）
sudo sysctl vm.swappiness=10

# 永久调整（推荐值：10-30）
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

**swappiness 值说明**：
- **0**：尽量不使用交换空间，只有内存极度不足时才用
- **10**：较少使用交换空间（推荐用于服务器）
- **30**：适度使用交换空间
- **60**：Linux 默认值
- **100**：积极使用交换空间

---

## 🗑️ 禁用和删除交换空间

如果你想移除交换空间：

```bash
# 1. 禁用交换空间
sudo swapoff /swapfile

# 2. 从 fstab 中删除配置
sudo sed -i '/swapfile/d' /etc/fstab

# 3. 删除交换文件
sudo rm /swapfile

# 4. 验证已删除
free -h
```

---

## ⚙️ 针对 Docker 构建的优化配置

### 在部署前设置交换空间

```bash
# 完整的优化脚本
#!/bin/bash

echo "📋 检查现有交换空间..."
swapon --show

if [ -f /swapfile ]; then
    echo "⚠️  /swapfile 已存在，跳过创建"
else
    echo "🔧 创建 2GB 交换空间..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile

    echo "✅ 交换空间创建成功"
fi

echo "📊 当前内存和交换空间状态："
free -h

echo "🔧 优化 swappiness 值..."
sudo sysctl vm.swappiness=10

echo "💾 添加到 fstab（开机自动启用）..."
if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ 已添加到 fstab"
else
    echo "ℹ️  fstab 中已存在配置"
fi

echo ""
echo "✅ 交换空间设置完成！"
echo "现在可以运行 ./deploy.sh 进行部署"
```

保存为 `setup_swap.sh` 并执行：
```bash
chmod +x setup_swap.sh
./setup_swap.sh
```

---

## 🎯 部署流程（完整版）

### 步骤1：设置交换空间
```bash
# 在服务器上执行
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h  # 验证
```

### 步骤2：清理 Docker 资源
```bash
cd /home/chainreactions/app
docker compose down
docker system prune -af --volumes
docker builder prune -af
```

### 步骤3：拉取最新代码
```bash
git pull origin main
git log -1 --oneline  # 验证最新 commit
```

### 步骤4：执行部署
```bash
./deploy.sh
```

---

## 🔍 故障排查

### 问题1：fallocate 失败
**错误**：`fallocate: fallocate failed: Operation not supported`

**解决**：使用 dd 命令代替
```bash
sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 问题2：交换空间未启用
**检查**：
```bash
# 查看交换空间
swapon --show

# 查看系统日志
dmesg | grep swap

# 验证文件存在且权限正确
ls -lh /swapfile
```

### 问题3：性能仍然慢
**原因**：交换空间在硬盘上，速度比内存慢很多

**优化**：
```bash
# 调整 swappiness 让系统尽量使用物理内存
sudo sysctl vm.swappiness=10

# 查看 I/O 使用情况
iostat -x 2

# 监控交换空间实际使用
watch -n 1 'free -h && echo "" && swapon --show'
```

---

## 📈 性能影响

### 预期效果

**没有交换空间**：
- Docker 构建可能因 OOM 被杀死
- npm install 可能卡住或失败
- TypeScript 编译可能崩溃

**有 2GB 交换空间**：
- ✅ Docker 构建稳定完成
- ✅ npm install 不会被杀死
- ✅ 可以同时构建多个服务（如果使用并行构建）
- ⚠️  如果频繁使用交换空间，速度会变慢

### 监控交换空间使用

```bash
# 实时监控（每2秒刷新）
watch -n 2 'echo "=== Memory Usage ===" && free -h && echo "" && echo "=== Swap Usage ===" && swapon --show && echo "" && echo "=== Top Memory Processes ===" && ps aux --sort=-%mem | head -6'
```

---

## 🎯 最佳实践

### 1. 临时测试环境
如果只是临时部署测试，可以不添加到 fstab：
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 2. 生产环境
生产环境建议永久配置：
```bash
# 设置交换空间并添加到 fstab
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 优化 swappiness
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

### 3. 大型项目
如果有更多微服务或更复杂的构建：
```bash
# 创建 4GB 交换空间
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## ⚠️ 注意事项

1. **SSD vs HDD**
   - DigitalOcean Droplet 通常使用 SSD，交换空间性能较好
   - HDD 服务器上交换空间会很慢

2. **不是内存替代品**
   - 交换空间只是临时缓解方案
   - 长期应考虑升级到 4GB RAM 服务器

3. **磁盘空间**
   - 确保有足够磁盘空间（至少 5GB 可用）
   - 检查：`df -h /`

4. **I/O 性能**
   - 频繁使用交换空间会增加磁盘 I/O
   - 监控磁盘健康：`iostat -x 2`

---

## 📞 常见问题

**Q: 交换空间会降低性能吗？**
A: 如果系统频繁使用交换空间（称为"颠簸"），性能会明显下降。通过设置低 swappiness 值（10-30）可以缓解。

**Q: 2GB 够用吗？**
A: 对于顺序构建 5 个微服务，2GB 交换空间 + 2GB RAM 应该够用。如果不够，可以增加到 4GB。

**Q: 是否影响 SSD 寿命？**
A: 现代 SSD 写入寿命很长，正常使用交换空间不会明显影响寿命。

**Q: 可以在 Docker 内部使用交换空间吗？**
A: 不需要。Docker 容器会使用宿主机的交换空间。

---

**最后更新**：2025年10月20日
**适用于**：DigitalOcean 2GB RAM Droplet
**相关文档**：EMERGENCY_RECOVERY.md

---

## 🔗 相关资源

- [Linux Swap Space](https://wiki.archlinux.org/title/Swap)
- [DigitalOcean: How To Add Swap Space](https://www.digitalocean.com/community/tutorials/how-to-add-swap-space-on-ubuntu-20-04)
- [Kernel Documentation: Swappiness](https://www.kernel.org/doc/Documentation/sysctl/vm.txt)
