const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use(session({
  secret: "mill_secret",
  resave: false,
  saveUninitialized: true
}));

const db = new sqlite3.Database("mill.db");

// Tables
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS attendance (id INTEGER PRIMARY KEY, name TEXT, status TEXT, date TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS stock (id INTEGER PRIMARY KEY, opening REAL, production REAL, closing REAL, date TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS purchase (id INTEGER PRIMARY KEY, party TEXT, qty REAL, date TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY, party TEXT, qty REAL, date TEXT)");
});

// Create default user
(async () => {
  const hash = await bcrypt.hash("admin123", 10);
  db.run("INSERT OR IGNORE INTO users (id, username, password) VALUES (1, 'admin', ?)", [hash]);
})();

// Auth middleware
function checkAuth(req, res, next) {
  if (!req.session.user) return res.status(403).send("Login required");
  next();
}

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (!user) return res.status(401).send("Invalid");

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).send("Invalid");

    req.session.user = username;
    res.send("OK");
  });
});

// Attendance
app.post("/attendance", checkAuth, (req, res) => {
  const { name, status, date } = req.body;
  db.run("INSERT INTO attendance (name, status, date) VALUES (?, ?, ?)", [name, status, date]);
  res.send("OK");
});

app.get("/attendance", checkAuth, (req, res) => {
  db.all("SELECT * FROM attendance ORDER BY date DESC", [], (err, rows) => res.json(rows));
});

// Stock
app.post("/stock", checkAuth, (req, res) => {
  const { opening, production, date } = req.body;
  const closing = opening + production;

  db.run("INSERT INTO stock (opening, production, closing, date) VALUES (?, ?, ?, ?)",
    [opening, production, closing, date]);

  res.json({ closing });
});

app.get("/stock", checkAuth, (req, res) => {
  db.all("SELECT * FROM stock ORDER BY date DESC", [], (err, rows) => res.json(rows));
});

// Purchase
app.post("/purchase", checkAuth, (req, res) => {
  const { party, qty, date } = req.body;
  db.run("INSERT INTO purchase (party, qty, date) VALUES (?, ?, ?)", [party, qty, date]);
  res.send("OK");
});

app.get("/purchase", checkAuth, (req, res) => {
  db.all("SELECT * FROM purchase ORDER BY date DESC", [], (err, rows) => res.json(rows));
});

// Sales
app.post("/sales", checkAuth, (req, res) => {
  const { party, qty, date } = req.body;
  db.run("INSERT INTO sales (party, qty, date) VALUES (?, ?, ?)", [party, qty, date]);
  res.send("OK");
});

app.get("/sales", checkAuth, (req, res) => {
  db.all("SELECT * FROM sales ORDER BY date DESC", [], (err, rows) => res.json(rows));
});

// Reports
app.get("/report", checkAuth, (req, res) => {
  db.get(`
    SELECT 
      (SELECT IFNULL(SUM(qty),0) FROM purchase) as purchase,
      (SELECT IFNULL(SUM(qty),0) FROM sales) as sales,
      (SELECT IFNULL(SUM(production),0) FROM stock) as production
  `, [], (err, row) => res.json(row));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on " + PORT));
