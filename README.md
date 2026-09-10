# Filmski sledilnik 🎬
**100% brezplačen** sledilnik novih filmov s scnsrc.me — brez API ključev.

---

## Kako deluje

| Korak | Opis |
|---|---|
| **Scraping** | Vsako uro prebere RSS feed `scnsrc.me/category/films/feed/` |
| **Filtriranje** | Zavrže CAM, SCR, BDSCR, DVDSCR, R5, Telesync, Telecine |
| **Dedupliciranje** | En film = ena kartica; obdrži najboljšo kvaliteto (4K > 1080p > 720p) |
| **Prevajanje** | MyMemory API (brezplačen, brez registracije) ali samogostovani LibreTranslate |
| **Žanri** | Lokalni slovar en→sl (brez omrežnih klicev) |
| **Shramba** | `data/movies.json` — preživi ponovne zagonee, filmi ostanejo 14 dni |

---

## Hitra namestitev (lokalno)

```bash
git clone <tvoj-repo> filmski-sledilnik
cd filmski-sledilnik
npm install
cp .env.example .env    # po želji uredi
npm start
# → http://localhost:3000
```

`.env` je neobvezen — brez njega dela z privzetimi nastavitvami.

---

## Nastavitve (.env)

```env
PORT=3000
FETCH_INTERVAL_MINUTES=60

# Neobvezno: e-mail poveča dnevni limit MyMemory iz 5 000 na 10 000 znakov
# Registracija: https://mymemory.translated.net/  (brezplačno)
MYMEMORY_EMAIL=tvoj@email.com

# Neobvezno: URL tvojega samogostovanega LibreTranslate (unlimited, brezplačen)
# Ko je nastavljeno, se MyMemory ne uporabi
LIBRETRANSLATE_URL=http://localhost:5000
```

---

## Gostovanje — možnosti od boljše do slabše

### ✅ Možnost 1 — Oracle Cloud Free Tier (priporočeno)
Brezplačen VPS za vedno, 1 GB RAM, dovolj za ta projekt.

1. Registracija: https://www.oracle.com/cloud/free/
2. Ustvari VM Instance (Ubuntu 22.04, Always Free shape: VM.Standard.A1.Flex)
3. Na strežniku:
```bash
# Namesti Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Kloniraj & nastavi
git clone <tvoj-repo> ~/filmi
cd ~/filmi
npm install
cp .env.example .env
nano .env   # nastavi po potrebi

# Namesti PM2 (process manager)
sudo npm install -g pm2
pm2 start src/server.js --name filmi
pm2 save
pm2 startup   # sledi navodilom za zagon ob zagonu

# (Neobvezno) Nginx reverse proxy na port 80
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/filmi
```
Nginx konfiguracija:
```nginx
server {
    listen 80;
    server_name tvoja-domena.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/filmi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### ✅ Možnost 2 — Render.com (brezplačen tier)

> ⚠ Brezplačni tier "zaspi" po 15 min neaktivnosti — poller se ustavi.
> Rešitev: nastavi UptimeRobot (brezplačen) da pinga tvoj URL vsake 10 minut.

1. Push kodo na GitHub
2. Render.com → New Web Service → poveži repozitorij
3. Build Command: `npm install`
4. Start Command: `node src/server.js`
5. Environment → dodaj spremenljivke iz `.env`
6. Deploy

---

### ✅ Možnost 3 — Railway.app

1. Push na GitHub
2. railway.app → New Project → Deploy from GitHub
3. Dodaj env spremenljivke
4. Railway samodejno zazna Node.js in zažene `npm start`

Brezplačni tier: $5 kredita/mesec (= ~500h — dovolj za en projekt).

---

### ✅ Možnost 4 — Fly.io

```bash
npm install -g flyctl
fly auth login
fly launch     # sledi navodilom
fly secrets set PORT=8080
fly deploy
```

Brezplačni tier: 3 shared-cpu VMs.

---

## Samogostovani LibreTranslate (neomejeno prevajanje)

Če nimaš interneta ali hočeš neomejeno prevajanje:

### Docker (najlažje):
```bash
docker run -d \
  --name libretranslate \
  --restart unless-stopped \
  -p 5000:5000 \
  libretranslate/libretranslate \
  --load-only en,sl
```

Nato v `.env`:
```env
LIBRETRANSLATE_URL=http://localhost:5000
```

Ob prvem zagonu prenese jezikovne modele (~300 MB). Po tem dela offline.

### Brez Dockerja:
```bash
pip install libretranslate
libretranslate --load-only en,sl --port 5000
```

---

## API

| Endpoint | Metoda | Opis |
|---|---|---|
| `/api/movies` | GET | Vse filme + status pollerja |
| `/api/status` | GET | Samo status |
| `/api/refresh` | POST | Takoj sproži osvežitev |

---

## Prevajanje — omejitve

| Storitev | Limit | Zahteve |
|---|---|---|
| **MyMemory** (privzeto) | 5 000 znakov/dan brez e-maila, 10 000 z e-mailom | Nič |
| **MyMemory + e-mail** | 10 000 znakov/dan | Brezplačna registracija |
| **LibreTranslate (self-host)** | Neomejeno | Docker ali Python |

Pri 10 filmih/dan s sinopsisom ~200 znakov = ~2 000 znakov/dan → MyMemory brez težav.
