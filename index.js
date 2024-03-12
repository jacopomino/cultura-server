import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import {MongoClient,ObjectId} from "mongodb"
import fileupload from "express-fileupload"
import axios from "axios"
import cheerio from "cheerio"
import fetch from "node-fetch"

const PORT = process.env.PORT|| 3001;
const app=express()
app.use(cors())
app.use(fileupload());
app.use(bodyParser.urlencoded({extended:true}))
app.listen(PORT,()=>{
    console.log("run");
})

const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")

app.put("/wiki", async (req,res)=>{
    let info=req.body
    const query = `
    [out:json];
    nwr["tourism"="attraction"](around:3000,`+info.lat+`,`+info.lon+`);
    out geom;
    `
    axios.post('https://overpass-api.de/api/interpreter', query).then(response => {
        res.send(response.data.elements);
    }).catch(error => {
        console.error('Errore durante la richiesta Overpass:', error);
    });
})
app.put("/wikiText", async (req,res)=>{
    let info=req.body
    let nome=info.nome
    if(info.wikipedia){
        nome=info.wikipedia.split(":")[1]
    }
    if(info.city&&!nome.includes("("+info.city+")")&&!nome.includes(info.city)){
        nome=nome+" ("+info.city+")"
    }
    axios.get("https://it.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch="+nome).then(e=>{
        axios.get("https://it.wikipedia.org/w/api.php?action=parse&format=json&pageid="+e.data.query.search[0].pageid).then(i=>{
            const array=[]
            let primoH3
            let h
            if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').text()!==""){
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').first()
                h=(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3'));
            }else if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').text()!==""){
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').first()
                h=(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2'));
            }
            const paragrafo=primoH3.prevAll("p")
            let p=""
            paragrafo.each((index, element) => {
                p=p+" "+(cheerio.load(i.data.parse.text["*"])(element).text());
            });
            if(p!==""){
                array.push({titolo:"In generale",testo:p})
            }
            h.each((index, element) => {
                let titolo=(cheerio.load(i.data.parse.text["*"])(element).text().replace(/\[.*?\]/g,""));
                let testo=""
                const paragraphs=cheerio.load(i.data.parse.text["*"])(element).nextUntil('h3', 'p')
                paragraphs.each((index, paragraph) => {
                    testo=testo+" "+(cheerio.load(i.data.parse.text["*"])(paragraph).text()); // Stampa il testo del paragrafo
                });
                if(testo!==""){
                    array.push({titolo:titolo,testo:testo})
                }
            });
            if(array.length>0){
                res.send(array)
            }else{
                if(p!==""){
                    res.send([{titolo:"In generale",testo:cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr p').text()}])
                }else{
                    res.send([{titolo:"In generale",testo:"Non trovo informazioni a riguardo"}])
                }
            }
            
        })
    }).catch(error => {
        console.error('Errore durante la richiesta Overpass:', error);
    });
})
app.put("/wikiAudio", async (req,res)=>{
    let info=req.body
    const url = 'https://api.play.ht/api/v2/tts';
    const options = {
    method: 'POST',
    headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
        AUTHORIZATION: '5b60e0c34c284a7fae4732462aaf2d10',
        'X-USER-ID': 'Dzsr4BLOlmhX4aIpUUt9v6xKYdc2'
    },
    body: JSON.stringify({
        text: info.testo,
        voice: 's3://voice-cloning-zero-shot/d9ff78ba-d016-47f6-b0ef-dd630f59414e/female-cs/manifest.json',
        quality: 'draft',
        output_format: 'mp3',
        speed: 1,
        sample_rate: 24000,
        seed: null,
        temperature: null,
        voice_engine: 'PlayHT2.0',
        emotion: 'female_happy',
        voice_guidance: 3,
        style_guidance: 20
    })
    };
fetch(url, options).then(res => res.json()).then(json => res.send(json)).catch(err => console.error('error:' + err));
})