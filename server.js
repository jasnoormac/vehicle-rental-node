const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
console.log('✅ Loaded env variables:', {
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD ? '***' : '(none)',
  DB_NAME: process.env.DB_NAME
});

const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layout');

// ---------- MIDDLEWARE ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
console.log('Looking for views in:', app.get('views'));


app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // no maxAge => session cookie (deleted when browser closes)
    },
  })
);

// ---------- DB CONNECTION ----------
let pool;

async function initDb() {
  pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    decimalNumbers: true,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

initDb().catch((err) => {
  console.error('Error initializing DB pool:', err);
  process.exit(1);
});

// ---------- HELPERS ----------
function ensureLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function attachUserToLocals(req, res, next) {
  res.locals.currentUser = req.session.user || null;
  next();
}
app.use(attachUserToLocals);

// ---------- ROUTES ----------

// Home -> redirect to login or locations
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/locations');
  }
  res.redirect('/login');
});

// LOGIN
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/locations');
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [
      email,
    ]);
    if (rows.length === 0) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.redirect('/locations');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Server error' });
  }
});

// SIGNUP
app.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/locations');
  res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.render('signup', { error: 'Email already in use' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hash]
    );
    req.session.user = { id: result.insertId, name, email };
    res.redirect('/locations');
  } catch (err) {
    console.error(err);
    res.render('signup', { error: 'Server error' });
  }
});

// LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

// ---------- STEP 1: LOCATION ----------
app.get('/locations', ensureLoggedIn, async (req, res) => {
  try {
    const [locations] = await pool.query('SELECT * FROM locations');
    res.render('location', { locations });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post('/locations', ensureLoggedIn, (req, res) => {
  const { location_id, start_date, end_date } = req.body;
  req.session.booking = {
    location_id,
    start_date,
    end_date,
  };
  res.redirect('/cars');
});

// ---------- STEP 2: CARS ----------
app.get('/cars', ensureLoggedIn, async (req, res) => {
  const booking = req.session.booking;
  if (!booking || !booking.location_id) return res.redirect('/locations');

  // ✅ Fetch all cars regardless of location
  const [rows] = await pool.query('SELECT * FROM cars');

  res.render('cars', { cars: rows });
});


app.post('/cars', ensureLoggedIn, async (req, res) => {
  const { car_id } = req.body;
  const booking = req.session.booking || {};

  console.log("Selected car_id:", car_id); // ✅ debug log

  try {
    const [rows] = await pool.query('SELECT * FROM cars WHERE id = ?', [car_id]);
    console.log("Query result:", rows); // ✅ debug log

    if (!rows || rows.length === 0) {
      console.error('❌ No car found with ID', car_id);
      return res.status(404).send('Car not found');
    }

    const car = rows[0];
    booking.car_id = car.id;
    booking.car_daily_price = parseFloat(car.daily_price);

    req.session.booking = booking;

    console.log("✅ Stored in session:", req.session.booking);
    res.redirect('/insurance');
  } catch (err) {
    console.error("DB error fetching car:", err);
    res.status(500).send("Database error fetching car");
  }
});

// ---------- STEP 3: INSURANCE ----------
app.get('/insurance', ensureLoggedIn, async (req, res) => {
  if (!req.session.booking || !req.session.booking.car_id)
    return res.redirect('/cars');
  try {
    const [insurances] = await pool.query('SELECT * FROM insurance_options');
    res.render('insurance', { insurances });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post('/insurance', ensureLoggedIn, async (req, res) => {
  const { insurance_id } = req.body;
  const booking = req.session.booking;

  const [[insurance]] = await pool.query('SELECT * FROM insurance_options WHERE id = ?', [insurance_id]);
  booking.insurance_id = insurance_id;
  booking.insurance_price_per_day = parseFloat(insurance.price_per_day);

  res.redirect('/accessories');
});


// ---------- STEP 4: ACCESSORIES ----------
app.get('/accessories', ensureLoggedIn, async (req, res) => {
  if (!req.session.booking || !req.session.booking.car_id)
    return res.redirect('/cars');
  try {
    const [accessories] = await pool.query('SELECT * FROM accessories');
    res.render('accessories', { accessories });
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.post('/accessories', ensureLoggedIn, async (req, res) => {
  const booking = req.session.booking;
  const { accessory_ids } = req.body;

  if (!booking || !booking.car_id) {
    return res.redirect('/cars');
  }

  let accessories = [];
  if (accessory_ids && accessory_ids.length > 0) {
    const ids = Array.isArray(accessory_ids) ? accessory_ids : [accessory_ids];
    const [accRows] = await pool.query(
      `SELECT * FROM accessories WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    accessories = accRows;
  }

  // ✅ Save selected accessories (with prices) to the session
  req.session.booking.accessories = accessories.map(a => ({
    id: a.id,
    name: a.name,
    price: parseFloat(a.price_flat)
  }));

  res.redirect('/payment');
});


// ---------- STEP 5: PAYMENT / SUMMARY ----------
function dateDiffInDays(d1, d2) {
  const diffMs = new Date(d2) - new Date(d1);
  return Math.max(1, diffMs / (1000 * 60 * 60 * 24));
}

app.get('/payment', ensureLoggedIn, async (req, res) => {
  const booking = req.session.booking;
  if (!booking || !booking.car_id) return res.redirect('/cars');

  const days = dateDiffInDays(booking.start_date, booking.end_date);
  const carTotal = booking.car_daily_price * days;
  const insuranceTotal = (booking.insurance_price_per_day || 0) * days;
  const accessoriesTotal = Array.isArray(booking.accessories)
  ? booking.accessories.reduce((sum, a) => sum + Number(a.price || a.price_flat || 0), 0)
  : 0;

   const totalPrice = Number(carTotal) + Number(insuranceTotal) + Number(accessoriesTotal);


  booking.total_price = totalPrice;

  // get some info to show nicely
  const [carRows] = await pool.query(
    'SELECT cars.*, locations.city, locations.branch_name FROM cars JOIN locations ON cars.location_id = locations.id WHERE cars.id = ?',
    [booking.car_id]
  );
  const car = carRows[0];

  let insurance = null;
  if (booking.insurance_id) {
    const [insRows] = await pool.query(
      'SELECT * FROM insurance_options WHERE id = ?',
      [booking.insurance_id]
    );
    insurance = insRows[0];
  }

  let accessories = [];
  if (booking.accessories && booking.accessories.length > 0) {
    const ids = booking.accessories.map((a) => a.id);
    const [accRows] = await pool.query(
      `SELECT * FROM accessories WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    accessories = accRows;
  }

  console.log({
  carTotal,
  insuranceTotal,
  accessoriesTotal,
  totalPrice,
  booking
});

  res.render('payment', {
    booking,
    car,
    insurance,
    accessories,
    days,
    carTotal,
    insuranceTotal,
    accessoriesTotal,
    totalPrice,
  });
});

app.post('/payment', ensureLoggedIn, async (req, res) => {
  const booking = req.session.booking;
  if (!booking || !booking.car_id) return res.redirect('/cars');

  try {
    const [result] = await pool.query(
      'INSERT INTO reservations (user_id, car_id, location_id, insurance_id, start_date, end_date, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        req.session.user.id,
        booking.car_id,
        booking.location_id,
        booking.insurance_id,
        booking.start_date,
        booking.end_date,
        booking.total_price,
      ]
    );
    const reservationId = result.insertId;

    if (booking.accessories && booking.accessories.length > 0) {
      for (const acc of booking.accessories) {
        await pool.query(
          'INSERT INTO reservation_accessories (reservation_id, accessory_id) VALUES (?, ?)',
          [reservationId, acc.id]
        );
      }
    }

    // clear booking data but keep user logged in
    delete req.session.booking;

    res.redirect('/reservations');
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

// ---------- CRUD: USER RESERVATIONS ----------

// List all reservations for the logged-in user
app.get('/reservations', ensureLoggedIn, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, c.model, c.daily_price, l.city, l.branch_name
       FROM reservations r
       JOIN cars c ON r.car_id = c.id
       JOIN locations l ON r.location_id = l.id
       WHERE r.user_id = ?
       ORDER BY r.created_at DESC`,
      [req.session.user.id]
    );

    res.render('reservations', { reservations: rows });
  } catch (err) {
    console.error("❌ Error fetching reservations:", err);
    res.sendStatus(500);
  }
});


// ---------- EDIT RESERVATION (GET) ----------
app.get('/reservations/:id/edit', ensureLoggedIn, async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch current reservation
    const [[reservation]] = await pool.query(
      `SELECT r.*, c.model, c.location_id, l.city, l.branch_name
       FROM reservations r
       JOIN cars c ON r.car_id = c.id
       JOIN locations l ON c.location_id = l.id
       WHERE r.id = ? AND r.user_id = ?`,
      [id, req.session.user.id]
    );

    if (!reservation) return res.status(404).send('Reservation not found');

    // Fetch supporting data for form
    const [cars] = await pool.query('SELECT * FROM cars WHERE location_id = ?', [reservation.location_id]);
    const [insuranceOptions] = await pool.query('SELECT * FROM insurance_options');
    const [accessories] = await pool.query('SELECT * FROM accessories');

    // Fetch current accessories for this reservation
    const [selectedAccessories] = await pool.query(
      `SELECT accessory_id FROM reservation_accessories WHERE reservation_id = ?`,
      [id]
    );
    const selectedAccessoryIds = selectedAccessories.map(a => a.accessory_id);

    res.render('edit_reservation', {
      reservation,
      cars,
      insuranceOptions,
      accessories,
      selectedAccessoryIds
    });
  } catch (err) {
    console.error('❌ Error loading reservation for edit:', err);
    res.sendStatus(500);
  }
});


// ---------- EDIT RESERVATION (POST) ----------
app.post('/reservations/:id/update', ensureLoggedIn, async (req, res) => {
  const { id } = req.params;
  const { car_id, insurance_id, accessory_ids, start_date, end_date } = req.body;

  try {
    // Calculate totals
    const [[car]] = await pool.query('SELECT daily_price FROM cars WHERE id = ?', [car_id]);
    const [[insurance]] = await pool.query(
      'SELECT price_per_day FROM insurance_options WHERE id = ?',
      [insurance_id || null]
    );

    const days = dateDiffInDays(start_date, end_date);
    const carTotal = Number(car.daily_price) * days;
    const insuranceTotal = (insurance ? Number(insurance.price_per_day) : 0) * days;

    // Get accessories total
    let accessoriesTotal = 0;
    let accessoryList = [];
    if (Array.isArray(accessory_ids) && accessory_ids.length > 0) {
      const [accRows] = await pool.query(
        `SELECT id, price_flat FROM accessories WHERE id IN (${accessory_ids.map(() => '?').join(',')})`,
        accessory_ids
      );
      accessoriesTotal = accRows.reduce((sum, a) => sum + Number(a.price_flat || 0), 0);
      accessoryList = accRows;
    }

    const totalPrice = carTotal + insuranceTotal + accessoriesTotal;

    // Update main reservation
    await pool.query(
      `UPDATE reservations
       SET car_id = ?, insurance_id = ?, start_date = ?, end_date = ?, total_price = ?
       WHERE id = ? AND user_id = ?`,
      [car_id, insurance_id || null, start_date, end_date, totalPrice, id, req.session.user.id]
    );

    // Update accessories
    await pool.query('DELETE FROM reservation_accessories WHERE reservation_id = ?', [id]);
    if (accessoryList.length > 0) {
      const accessoryValues = accessoryList.map(a => [id, a.id]);
      await pool.query(
        'INSERT INTO reservation_accessories (reservation_id, accessory_id) VALUES ?',
        [accessoryValues]
      );
    }

    console.log(`✅ Reservation ${id} updated successfully`);
    res.redirect('/reservations');
  } catch (err) {
    console.error('❌ Error updating reservation:', err);
    res.sendStatus(500);
  }
});


// ---------- DELETE: remove reservation ----------
app.post('/reservations/:id/delete', ensureLoggedIn, async (req, res) => {
  const { id } = req.params;
  try {
    // First delete any accessories linked to this reservation
    await pool.query(
      'DELETE FROM reservation_accessories WHERE reservation_id = ?',
      [id]
    );

    // Then delete the main reservation
    await pool.query(
      'DELETE FROM reservations WHERE id = ? AND user_id = ?',
      [id, req.session.user.id]
    );

    console.log(`🗑️ Reservation ${id} deleted`);
    res.redirect('/reservations');
  } catch (err) {
    console.error("❌ Error deleting reservation:", err);
    res.sendStatus(500);
  }
});


// ---------- START SERVER ----------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
