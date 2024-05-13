import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import fileupload from "express-fileupload"
import path from "path"
import fs from "fs"
import nodemailer from "nodemailer"
import {MongoClient,ObjectId} from "mongodb"
import {Worker,isMainThread} from "worker_threads"

const app=express()
app.use(cors())
app.use(fileupload());
app.use(bodyParser.urlencoded({extended:true}))
const PORT = process.env.PORT|| 3001;
app.listen(PORT,()=>{
    console.log("run");
})
const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")
/*import mysql from "mysql2"
const connection = mysql.createConnection({
    host:"127.0.0.1",
    //host:"3.75.158.163",
    user:"root",
    password:"Jac2001Min!",
    database:"gita"
});
const createTableQuery = `
CREATE TABLE IF NOT EXISTS utente (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    nome VARCHAR(100),
    professione VARCHAR(100),
    nascita DATE
)`;
connection.query(createTableQuery, (error, results) => {
    if (error) {
        console.error('Errore durante la creazione della tabella',error);
        return;
    }
    console.log('Tabella creata o già esistente');
});*/
//l'utente ottiene la posizione delle attrazioni turistiche intorno all'utente
app.put("/wiki", async (req,res)=>{
    if(isMainThread){
        const worker=new Worker('./wiki.js');
        worker.on("message", result => {
            res.send(result)
        })
        worker.on('error', err => {
            res.status(203).send('Internal Server Error');
        });
        worker.postMessage({ type:'start',body: req.body});
    }
})
app.put("/wikiBound", async (req,res)=>{
    if(isMainThread){
        const worker=new Worker('./wikiBound.js');
        worker.on("message", result => {
            res.send(result)
        })
        worker.on('error', err => {
            res.status(203).send('Internal Server Error');
        });
        worker.postMessage({ type:'start',body: req.body});
    }
})
//l'utente ottiene i testi dell'attrazione turistica di interesse
app.put("/wikiText", async (req,res)=>{
    if(isMainThread){
        const worker=new Worker('./wikiText.js');
        worker.on("message", result => {
            if(result.type==="error"){
                res.send(result.error)
            }else{
                res.send(result)
            }
        })
        worker.on('error', err => {
            res.status(203).send('Internal Server Error. Try Again!');
        });
        worker.postMessage({type:'start',body: req.body});
    }
})
app.put("/wikiAudio", async (req,res)=>{
    if(isMainThread){
        const worker=new Worker('./wikiAudio.js');
        worker.on("message", result => {
            if(result.type==="error"){
                res.status(203).send(result.error)
            }else{
                res.send(result)
            }
        })
        worker.on('error', err => {
            console.log(err);
            res.status(203).send('Internal Server Error. Try Again!');
        });
        worker.postMessage({type:'start',body:req.body});
    }
})
app.get("/audio/:id", async (req,res)=>{
    res.sendFile(path.resolve('Voice'+req.params.id+'.mp3'))
})
app.put("/sendEmail", async (req,res)=>{
    let info=req.body
    let countError=0
    let error="you have not filled in the field: "
    if(info.email===""){
        countError++
        error=error+"email, "
    }
    if(info.oggetto===""){
        countError++
        error=error+"object, "
    }
    if(info.testo===""){
        countError++
        error=error+"text, "
    }
    if(countError>0){
        res.status(203).send(error)
    }else{
        const trasportatore=nodemailer.createTransport({
            service:'gmail', // Puoi specificare il servizio di posta elettronica che stai utilizzando (es. 'gmail', 'hotmail', 'yahoo', ecc.)
            auth:{
                user:'nolomundus@gmail.com', // Inserisci il tuo indirizzo email
                pass:'rclh ruyt cxmy agpk' // Inserisci la tua password
            },
            tls:{
                rejectUnauthorized:false
            }
        });
        const opzioniEmail={
            from:info.email, // Inserisci il mittente
            to:'nolomundus@gmail.com', // Inserisci il destinatario
            subject:info.oggetto,
            text:info.email+", "+info.testo // Testo del messaggio
        };
        trasportatore.sendMail(opzioniEmail, function(error, info){
            if(error){
                console.log(error);
                res.status(203).send(error);
            }else{
                res.send("ok");
            }
        });
    }
})
app.put("/signup", async (req,res)=>{
    let info=req.body
    client.db("gita").collection("user").findOne({email:info.email}).then(e=>{
        if(e){
            res.status(203).send('Email already used');
        }else{
            client.db("gita").collection("user").insertOne(info).then(i=>{
                if(!i){
                    res.status(203).send("The procedure did not take place correctly")
                }else{
                    res.send(info)
                }
            })
        }
    })
    /*const insertQuery = `
        INSERT INTO utente (email, password, nome, professione, nascita)
        VALUES (?, ?, ?, ?, ?)
    `;
    connection.query(insertQuery, [userData.email, userData.password, userData.nome, userData.professione, userData.nascita], (error, results) => {
        if (error) {
            res.status(203).send('Email already used');
        }
        res.send(userData)
    });*/
})
app.put("/login", async (req,res)=>{
    let info=req.body
    client.db("gita").collection("user").findOne({password:info.password,email:info.email}).then(e=>{
        if(e){
            res.send(e)
        }else{
            res.status(203).send('Unregistered user');
        }
    })
    /*const userData = {
        email: info.email,
        password: info.password,
    };
    const selectUserQuery = `
        SELECT *
        FROM utente
        WHERE email = ? AND password = ?
    `;
    connection.query(selectUserQuery, [userData.email, userData.password], (error, results, fields) => {
        if (error) {
            res.status(203).send('Error searching for user');
        }
        if(results.length>0){
            res.send(results[0])
        }else{
            res.status(203).send('Unregistered user');
        }
    });*/
})
app.put("/delete", async (req,res)=>{
    let info=req.body
    client.db("gita").collection("user").deleteOne({password:info.password,email:info.email}).then(e=>{
        if(e){
            res.send("ok")
        }else{
            res.status(203).send('Error searching for user');
        }
    })
    /*const userData = {
        email: info.email,
        password: info.password,
    };
    const selectUserQuery = `
        DELETE
        FROM utente
        WHERE email = ? AND password = ?
    `;
    connection.query(selectUserQuery, [userData.email, userData.password], (error, results, fields) => {
        if (error) {
            res.status(203).send('Error searching for user');
        }
        if(results.length>0){
            res.send("ok")
        }
    });*/
})
app.put("/board", async (req,res)=>{
    let info=req.body
    client.db("gita").collection("user").updateOne({password:info.password,email:info.email},{$push:{board:{id:new ObjectId,citta:info.citta,dataBoard:info.dataBoard,text:info.text,data:info.data}}}).then(e=>{
        if(e){
            res.send("ok")
        }else{
            res.status(203).send('Error searching for user');
        }
    })
})
app.put("/submitToIdWiki", async (req,res)=>{
    let info=req.body
    client.db("gita").collection("user").findOne({password:info.password,email:info.email}).then(e=>{
        if(e){
            client.db("gita").collection("attractions").insertOne({idWiki:info.idWiki,text:info.text,file:info.file,utente:info.nome}).then((j)=>{
                if(j){
                    res.send("ok")
                }else{
                    res.status(203).send('Something wrong');
                }
            })
        }else{
            res.status(203).send('Unregistered user');
        }
    })
})
app.put("/getSubmitToIdWiki", async (req,res)=>{
    let info=req.body
    client.db("gita").collection("attractions").find({idWiki:info.idWiki}).toArray().then(e=>{
        if(e){
            res.send(e);
        }else{
            res.status(203).send('Find nothing');
        }
    })
})