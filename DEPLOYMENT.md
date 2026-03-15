# 🚀 Deployment Guide — e-AGM (Ubuntu Server + Cloudflare Tunnel)

> คู่มือนี้อธิบายวิธี deploy e-AGM บน **Ubuntu Server** ตั้งแต่เริ่มต้นจนเข้าถึงจากอินเทอร์เน็ตผ่าน **Cloudflare Tunnel**

---

## สารบัญ

1. [Prerequisites](#1-prerequisites)
2. [ติดตั้ง Node.js](#2-ติดตั้ง-nodejs)
3. [ติดตั้ง MS SQL Server](#3-ติดตั้ง-ms-sql-server-ทางเลือก)
4. [Clone & Setup โปรเจค](#4-clone--setup-โปรเจค)
5. [ตั้งค่า .env](#5-ตั้งค่า-env)
6. [Build & ทดสอบ](#6-build--ทดสอบ)
7. [รัน Production ด้วย PM2](#7-รัน-production-ดวย-pm2)
8. [ตั้งค่า Nginx (Reverse Proxy + SSE)](#8-ตั้งค่า-nginx-reverse-proxy--sse)
9. [Cloudflare Tunnel](#9-cloudflare-tunnel)
10. [Firewall & Security](#10-firewall--security)
11. [Maintenance & Troubleshooting](#11-maintenance--troubleshooting)

---

## 1. Prerequisites

| รายการ | ขั้นต่ำ | แนะนำ |
|--------|---------|-------|
| Ubuntu | 22.04 LTS | 24.04 LTS |
| RAM | 1 GB | 2 GB+ |
| Disk | 10 GB | 20 GB+ |
| Node.js | v20+ | v24 LTS |
| MS SQL Server | 2019+ | 2022 (หรือใช้ remote DB) |

> 💡 **หมายเหตุ**: ถ้าใช้ MS SQL Server จาก Windows server อื่น (เช่น `192.168.110.106\alpha`) ไม่ต้องลง SQL Server บน Ubuntu — แค่ให้ Ubuntu เข้าถึง DB server ได้

---

## 2. ติดตั้ง Node.js

```bash
# ใช้ NodeSource repository (Node.js v24)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# ตรวจสอบ
node -v    # v24.x.x
npm -v     # 11.x.x
```

### ทางเลือก: ใช้ nvm (แนะนำ)

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 24
nvm use 24
nvm alias default 24
```

---

## 3. ติดตั้ง MS SQL Server (ทางเลือก)

> ⚠️ ข้ามขั้นตอนนี้ถ้าใช้ MS SQL Server จากเครื่องอื่น (เช่น Windows Server)

```bash
# 1. Import Microsoft GPG Key
curl https://packages.microsoft.com/keys/microsoft.asc | sudo tee /etc/apt/trusted.gpg.d/microsoft.asc

# 2. Add repository (Ubuntu 22.04)
sudo add-apt-repository "$(wget -qO- https://packages.microsoft.com/config/ubuntu/22.04/mssql-server-2022.list)"

# 3. Install
sudo apt-get update
sudo apt-get install -y mssql-server

# 4. Setup (ตั้ง SA password)
sudo /opt/mssql/bin/mssql-conf setup
# เลือก Express edition (ฟรี) → ตั้ง SA password

# 5. ติดตั้ง SQL Tools (optional)
sudo apt-get install -y mssql-tools18 unixodbc-dev
echo 'export PATH="$PATH:/opt/mssql-tools18/bin"' >> ~/.bashrc
source ~/.bashrc

# 6. สร้าง Database
sqlcmd -S localhost -U sa -P 'YourPassword' -Q "CREATE DATABASE eagm_db"
```

### ตรวจสอบ remote connection (ถ้าใช้ DB จากเครื่องอื่น)

```bash
# ทดสอบว่า Ubuntu สามารถเข้าถึง SQL Server ได้
# ลง telnet/nc
sudo apt-get install -y netcat-openbsd

# ทดสอบ port
nc -zv 192.168.110.106 1433
# ถ้าได้ "Connection ... succeeded!" = OK
```

---

## 4. Clone & Setup โปรเจค

```bash
# 1. ติดตั้ง git (ถ้ายังไม่มี)
sudo apt-get install -y git

# 2. Clone repository
cd /home/$USER
git clone https://github.com/iEel/agm.git
cd agm

# 3. Install dependencies
npm install

# 4. Generate Prisma Client
npx prisma generate
```

---

## 5. ตั้งค่า .env

```bash
# Copy template
cp .env.example .env

# แก้ไข
nano .env
```

### ตัวอย่าง .env สำหรับ Production:

```env
# ---------- Application ----------
APP_NAME=e-AGM
APP_PORT=3000
NODE_ENV=production

# ---------- Database ----------
# กรณี remote DB (Windows Server)
DATABASE_URL=sqlserver://192.168.110.106:1433;database=eagm_db;user=sa;password=YourStrongPassword;encrypt=false;trustServerCertificate=true;instanceName=alpha

# กรณี local DB (Ubuntu)
# DATABASE_URL=sqlserver://localhost:1433;database=eagm_db;user=sa;password=YourStrongPassword;encrypt=false;trustServerCertificate=true

# ---------- Authentication ----------
# สร้าง secret ที่ปลอดภัย:
# openssl rand -base64 48
AUTH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_EXPIRES_IN=8h
```

### สร้าง AUTH_SECRET อัตโนมัติ:

```bash
# สร้าง random secret แล้วใส่เข้า .env
SECRET=$(openssl rand -base64 48)
sed -i "s|AUTH_SECRET=.*|AUTH_SECRET=$SECRET|" .env

# ตรวจสอบ
grep AUTH_SECRET .env
```

---

## 6. Build & ทดสอบ

```bash
# 1. Push schema ขึ้น DB (สร้าง tables — ทำครั้งแรกเท่านั้น)
npx prisma db push

# 2. Build production
npm run build

# 3. ทดสอบ start
npm run start
# เปิด http://<server-ip>:3000 ในเบราว์เซอร์

# 4. Seed ข้อมูลเริ่มต้น (ทำครั้งแรกเท่านั้น)
curl -X POST http://localhost:3000/api/seed
# จะสร้าง admin user: admin / admin1234

# 5. กด Ctrl+C เพื่อหยุด (จะไปใช้ PM2 แทน)
```

---

## 7. รัน Production ด้วย PM2

PM2 เป็น process manager ที่ทำให้ app:
- ✅ รันตลอด 24/7 (auto restart เมื่อ crash)
- ✅ เริ่มอัตโนมัติเมื่อเปิดเครื่อง
- ✅ ดู log ย้อนหลังได้

```bash
# 1. ติดตั้ง PM2
sudo npm install -g pm2

# 2. สร้าง ecosystem config
cat > /home/$USER/agm/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [{
    name: 'eagm',
    cwd: '/home/' + process.env.USER + '/agm',
    script: 'node_modules/.bin/next',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
EOF

# 3. สร้างโฟลเดอร์ logs
mkdir -p /home/$USER/agm/logs

# 4. Start app
cd /home/$USER/agm
pm2 start ecosystem.config.cjs

# 5. ตรวจสอบ
pm2 status        # ดูสถานะ
pm2 logs eagm     # ดู logs (real-time)

# 6. ตั้งค่า auto-start เมื่อเปิดเครื่อง
pm2 save          # บันทึก process list
pm2 startup       # สร้าง startup script
# จะแสดงคำสั่ง sudo ... — ก๊อปไปรัน
```

### คำสั่ง PM2 ที่ใช้บ่อย:

```bash
pm2 status                # ดูสถานะทุก process
pm2 logs eagm             # ดู logs แบบ real-time
pm2 logs eagm --lines 50  # ดู 50 บรรทัดล่าสุด
pm2 restart eagm          # restart app
pm2 stop eagm             # หยุด app
pm2 delete eagm           # ลบ process
pm2 monit                 # Monitor (CPU/RAM real-time)
```

---

## 8. ตั้งค่า Nginx (Reverse Proxy + SSE)

Nginx ทำหน้าที่เป็น reverse proxy: รับ request จาก port 80/443 → ส่งต่อไป Next.js port 3000

> ⚠️ **สำคัญ**: ต้อง config ให้รองรับ **SSE (Server-Sent Events)** ด้วย

```bash
# 1. ติดตั้ง Nginx
sudo apt-get install -y nginx

# 2. สร้าง config
sudo nano /etc/nginx/sites-available/eagm
```

### ใส่ config นี้:

```nginx
server {
    listen 80;
    server_name agm.yourdomain.com;  # เปลี่ยนเป็นโดเมนจริง

    # Upload limit สำหรับ logo/Excel import
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection '';          # สำคัญ! สำหรับ SSE
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support
        proxy_buffering off;                     # สำคัญ! ปิด buffering สำหรับ SSE
        proxy_cache off;                         # ปิด cache
        proxy_read_timeout 86400s;               # keep-alive 24 ชั่วโมง
        proxy_send_timeout 86400s;

        # Next.js static files
        proxy_set_header Accept-Encoding "";
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }

    # Uploaded files
    location /uploads/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 30d;
    }
}
```

```bash
# 3. Enable site
sudo ln -sf /etc/nginx/sites-available/eagm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default    # ลบ default site

# 4. ทดสอบ config
sudo nginx -t
# ต้องได้ "syntax is ok" + "test is successful"

# 5. Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# 6. ทดสอบ
curl -I http://localhost
# ต้องได้ HTTP 200
```

---

## 9. Cloudflare Tunnel

Cloudflare Tunnel ทำให้เข้าถึง server จากอินเทอร์เน็ตได้ **โดยไม่ต้องเปิด port** บน router/firewall

### ข้อดี:
- ✅ ไม่ต้องเปิด port 80/443 บน router
- ✅ ได้ SSL/HTTPS อัตโนมัติ (ฟรี)
- ✅ DDoS protection ฟรี
- ✅ ไม่ต้องมี static IP

### ข้อกำหนด:
- มี Cloudflare account (ฟรี)
- โดเมนที่ใช้ Cloudflare DNS (ย้าย nameserver มา Cloudflare)

### ขั้นตอน:

```bash
# ============================================================
# ขั้นตอนที่ 1: ติดตั้ง cloudflared
# ============================================================

# วิธีที่ 1: ดาวน์โหลด .deb (แนะนำ)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb

# วิธีที่ 2: ใช้ apt repository
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared

# ตรวจสอบ
cloudflared --version


# ============================================================
# ขั้นตอนที่ 2: Login เข้า Cloudflare
# ============================================================

cloudflared tunnel login
# จะเปิดเบราว์เซอร์ → เลือกโดเมน → Authorize
# ถ้าเป็น headless server ให้ก๊อป URL ไปเปิดบนเครื่องอื่น
# Certificate จะบันทึกที่ ~/.cloudflared/cert.pem


# ============================================================
# ขั้นตอนที่ 3: สร้าง Tunnel
# ============================================================

cloudflared tunnel create eagm
# จะสร้าง tunnel ID + credentials file
# Output: Created tunnel eagm with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
# จดจำ TUNNEL_ID ไว้


# ============================================================
# ขั้นตอนที่ 4: สร้าง config file
# ============================================================

mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml << 'EOF'
tunnel: TUNNEL_ID_HERE
credentials-file: /home/YOUR_USER/.cloudflared/TUNNEL_ID_HERE.json

ingress:
  # ถ้าใช้ Nginx (แนะนำ)
  - hostname: agm.yourdomain.com
    service: http://localhost:80

  # ถ้าไม่ใช้ Nginx (เชื่อมตรงไป Next.js)
  # - hostname: agm.yourdomain.com
  #   service: http://localhost:3000

  # Catch-all (จำเป็น)
  - service: http_status:404
EOF

# แก้ไข TUNNEL_ID_HERE และ YOUR_USER ให้ตรง
# nano ~/.cloudflared/config.yml


# ============================================================
# ขั้นตอนที่ 5: ตั้ง DNS record
# ============================================================

cloudflared tunnel route dns eagm agm.yourdomain.com
# จะสร้าง CNAME record ใน Cloudflare DNS อัตโนมัติ


# ============================================================
# ขั้นตอนที่ 6: ทดสอบ
# ============================================================

cloudflared tunnel run eagm
# เปิด https://agm.yourdomain.com ในเบราว์เซอร์
# Ctrl+C เพื่อหยุด (จะไปตั้ง service แทน)


# ============================================================
# ขั้นตอนที่ 7: ติดตั้งเป็น systemd service (รัน 24/7)
# ============================================================

sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# ตรวจสอบ
sudo systemctl status cloudflared
# ต้องได้ "Active: active (running)"
```

### ถ้าต้องการหลายโดเมน/Subdomain:

```yaml
# ~/.cloudflared/config.yml
tunnel: TUNNEL_ID
credentials-file: /home/user/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: agm.yourdomain.com
    service: http://localhost:80
  - hostname: api.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## 10. Firewall & Security

```bash
# 1. ตั้งค่า UFW (Ubuntu Firewall)
sudo ufw default deny incoming
sudo ufw default allow outgoing

# อนุญาต SSH (สำคัญ! อย่าลืม ไม่งั้นเข้าไม่ได้)
sudo ufw allow ssh

# ถ้าใช้ Cloudflare Tunnel → ไม่ต้องเปิด port 80/443!
# ถ้าไม่ใช้ Tunnel → เปิด port 80 + 443
# sudo ufw allow 80
# sudo ufw allow 443

# ถ้า DB อยู่บน Ubuntu เครื่องนี้ → อนุญาตจาก local เท่านั้น
# sudo ufw allow from 127.0.0.1 to any port 1433

# 2. Enable firewall
sudo ufw enable

# 3. ตรวจสอบ
sudo ufw status


# 4. (แนะนำ) เปลี่ยน SSH port
sudo nano /etc/ssh/sshd_config
# เปลี่ยน Port 22 → Port 2222 (หรือเลขอื่น)
# sudo ufw allow 2222
# sudo systemctl restart sshd
```

### Security Checklist:

- [ ] เปลี่ยน default admin password ทันทีหลัง login ครั้งแรก
- [ ] ตั้ง `AUTH_SECRET` ที่สุ่มมาจริงๆ (ไม่ใช่ค่า default)
- [ ] ตั้ง `NODE_ENV=production`
- [ ] ปิด port ที่ไม่จำเป็น
- [ ] ตั้ง strong password สำหรับ SQL Server SA account
- [ ] (แนะนำ) ใช้ fail2ban ป้องกัน brute force SSH

---

## 11. Maintenance & Troubleshooting

### อัปเดตโค้ด (Deploy version ใหม่):

```bash
cd /home/$USER/agm

# 1. ดึงโค้ดใหม่
git pull origin master

# 2. Install dependencies (ถ้ามี package ใหม่)
npm install

# 3. Generate Prisma Client (ถ้ามีการแก้ schema)
npx prisma generate

# 4. Push schema (ถ้ามี table ใหม่)
npx prisma db push

# 5. Build
npm run build

# 6. Restart
pm2 restart eagm

# 7. ตรวจสอบ
pm2 logs eagm --lines 20
```

### สร้างเป็น script (แนะนำ):

```bash
cat > /home/$USER/agm/deploy.sh << 'EOF'
#!/bin/bash
set -e
echo "🔄 Pulling latest code..."
git pull origin master
echo "📦 Installing dependencies..."
npm install
echo "🔧 Generating Prisma Client..."
npx prisma generate
echo "🏗️ Building..."
npm run build
echo "🔄 Restarting PM2..."
pm2 restart eagm
echo "✅ Deploy complete!"
pm2 logs eagm --lines 5
EOF

chmod +x /home/$USER/agm/deploy.sh

# ใช้: ./deploy.sh
```

### ดู Logs:

```bash
# PM2 logs
pm2 logs eagm                    # real-time
pm2 logs eagm --lines 100       # 100 บรรทัดล่าสุด

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Cloudflare Tunnel logs
sudo journalctl -u cloudflared -f

# System logs
sudo journalctl -u nginx -f
```

### แก้ปัญหาทั่วไป:

| ปัญหา | สาเหตุ | แก้ไข |
|--------|--------|-------|
| เข้าเว็บไม่ได้ (502) | Next.js ยังไม่ start | `pm2 restart eagm && pm2 logs eagm` |
| เข้าเว็บไม่ได้ (504) | DB connection timeout | ตรวจ `DATABASE_URL` + ทดสอบ `nc -zv <db-ip> 1433` |
| SSE ไม่ทำงาน | Nginx buffering | ตรวจ `proxy_buffering off;` ใน nginx config |
| อัพเดตช้า (รอ 5-10 วิ) | SSE ไม่ได้เชื่อม | ดู browser console → ถ้ามี error เกี่ยวกับ EventSource |
| Login ไม่ได้ | AUTH_SECRET เปลี่ยน | cookie เก่าใช้ไม่ได้ → ลบ cookie แล้ว login ใหม่ |
| Prisma error | schema ไม่ตรง | `npx prisma db push` แล้ว restart |
| Port 3000 ถูกใช้ | process ค้าง | `pm2 kill && pm2 start ecosystem.config.cjs` |
| Upload logo ไม่ได้ | permission | `sudo chown -R $USER:$USER /home/$USER/agm/public/uploads` |

### Backup Database:

```bash
# ถ้า SQL Server อยู่บน Ubuntu
# สำรองข้อมูลก่อนวันประชุม
sqlcmd -S localhost -U sa -P 'YourPassword' \
  -Q "BACKUP DATABASE eagm_db TO DISK='/home/$USER/backup/eagm_$(date +%Y%m%d).bak'"

# ถ้า SQL Server อยู่บน Windows
# ใช้ SSMS → Tasks → Backup
```

---

## สรุปขั้นตอนทั้งหมด (Quick Reference)

```bash
# === Ubuntu Server Setup ===
# 1. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx

# 2. Clone & Setup
git clone https://github.com/iEel/agm.git && cd agm
npm install
cp .env.example .env && nano .env        # แก้ .env
npx prisma generate
npx prisma db push

# 3. Build & Start
npm run build
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup

# 4. Nginx
sudo nano /etc/nginx/sites-available/eagm   # ใส่ config
sudo ln -sf /etc/nginx/sites-available/eagm /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# 5. Cloudflare Tunnel
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create eagm
nano ~/.cloudflared/config.yml              # ใส่ config
cloudflared tunnel route dns eagm agm.yourdomain.com
sudo cloudflared service install
sudo systemctl enable cloudflared && sudo systemctl start cloudflared

# 6. Seed admin
curl -X POST http://localhost:3000/api/seed

# 7. Firewall
sudo ufw allow ssh
sudo ufw enable

# 🎉 เข้าได้ที่ https://agm.yourdomain.com
# Login: admin / admin1234
```
