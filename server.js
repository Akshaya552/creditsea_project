const express = require("express");
const app = express();
const path = require("path");
const bcrypt = require("bcryptjs");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");
const jwt = require("jsonwebtoken");
app.use(express.json());
app.use(cors());

var LocalStorage = require("node-localstorage").LocalStorage,
  localStorage = new LocalStorage("./scratch");

const { format, formatDistanceToNow } = require("date-fns");

const dbPath = path.join(__dirname, "loanManager.db");

let db = null;


const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/signup", async (req, res) => {
  try{
  const { name, profile} = req.body;
  const selectUserQuery = `SELECT * FROM members WHERE name = '${name}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const present = format(new Date(), "MM/dd/yyyy");
    const addNewUserQuery = `INSERT INTO members(name,password,created_at,profile) VALUES 
    ('${name}','${hashedPassword}','${present}','${profile}')`;
    await db.run(addNewUserQuery);
    res.send({ message: "Registration Success" });
  } else {
    res.status(400);
    res.send({ message: "Username Already Registered" });
  }
  }catch(e){
    console.log(e);
  }
   
});


app.post("/login", async (req, res) => {
  const { name, password } = req.body;
  const selectUserQuery = `SELECT * FROM members WHERE name = '${name}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    res.status(400);
    res.send({ message: "User Not Registered" });
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        name: name.toLowerCase(),
      };
      localStorage.setItem("userId", dbUser.id);
      const jwtToken = jwt.sign(payload, "AUTHENTICATION_TOKEN");
      res.send({ jwtToken });
      
    } else {
      res.status(400);
      res.send({ message: "Invalid Password" });
    }
  }
});


app.get('/admin',async(req,res)=>{
    const getAdminQuery = `SELECT * FROM loan_form ORDER BY updated_at DESC`;
    const adimData = await db.all(getAdminQuery);
    res.send(adimData);
});

app.get('/verifier',async(req,res)=>{
    const verifierQuery = `SELECT * FROM loan_form WHERE action = 'pending' ORDER BY updated_at DESC;`
    const verifierdata = await db.all(verifierQuery);
    res.send(verifierdata);
});

app.get('/user',async(req,res)=>{
    const userId = localStorage.getItem('userId');
    const userQuery = `SELECT * FROM loan_form JOIN members on members.id = loan_form.user_id  WHERE members.id = ${userId} ORDER BY updated_at DESC;`
    const data = await db.all(userQuery);
    res.send(data);
});

app.post('/loan-form',async(req,res)=>{
    const userId = localStorage.getItem('userId');
    const{name,tenure,status,reason,amount,address} = req.body
    const present = format(new Date(), "MM/dd/yyyy");
    const insertLoan = `INSERT INTO loan_form(name,tenure,status,reason,amount,address,updated_at,action,user_id) VALUES ('${name}',${tenure},'${status}','${reason}',${amount},'${address}','${present}','Pending',${userId});`;
    await db.run(insertLoan);
    res.send('Form Added');
})

app.patch('/approval/:userId/:amount/',async(req,res)=>{
  const{action} = req.body
  const{userId,amount} = req.params;
  const updateQuery = `UPDATE loan_form SET action = '${action}' WHERE
   user_id = ${userId} 
   AND 
   amount = ${amount}`;
  await db.run(updateQuery);
})