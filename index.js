import cors from "cors"
import express from "express"
import bodyParser from "body-parser"
import {MongoClient,ObjectId} from "mongodb"
import fileupload from "express-fileupload"
import axios from "axios"
import cheerio from "cheerio"
import gTTS from "gtts"
import fs from "fs"
import path from "path"
import nodemailer from "nodemailer"

const PORT = process.env.PORT|| 3001;
const app=express()
app.use(cors())
app.use(fileupload());
app.use(bodyParser.urlencoded({extended:true}))
app.listen(PORT,()=>{
    console.log("run");
})

const client=new MongoClient("mongodb://apo:jac2001min@cluster0-shard-00-00.pdunp.mongodb.net:27017,cluster0-shard-00-01.pdunp.mongodb.net:27017,cluster0-shard-00-02.pdunp.mongodb.net:27017/?ssl=true&replicaSet=atlas-me2tz8-shard-0&authSource=admin&retryWrites=true&w=majority")
//l'utente ottiene la posizione delle attrazioni turistiche intorno all'utente
app.put("/wiki", async (req,res)=>{
    let info=req.body
    const query = `
    [out:json];
    nwr["tourism"="attraction"](around:`+info.raggio+`,`+info.lat+`,`+info.lon+`);
    out geom;
    `
    axios.post('https://overpass-api.de/api/interpreter', query).then(response => {
        res.send(response.data.elements);
    }).catch(error => {
        console.error('Errore durante la richiesta Overpass:', error);
    });
})
//l'utente ottiene i testi dell'attrazione turistica di interesse
//funzione per gestire errori
const error=(lingua,res)=>{
    let titolo="In generale"
    let testo="Non trovo informazioni a riguardo"
    let summary="Non trovo informazioni a riguardo"
    if(lingua==="en"){
        titolo="In general"
        testo="I can't find any information about it"
        summary="I can't find any information about it"
    }
    res.send([{titolo:titolo,testo:testo,riassunto:summary}])
}
//funzione per ottenere il testo in base alla pagina da analizzare
const text=(url,res,lingua)=>{
    axios.get(url).then(i=>{
        const img=[]
        cheerio.load(i.data.parse.text["*"])("img").map((i,n)=>{
            n.attribs.src.match(/\b\d{3}px\b/)&&img.push("https:"+n.attribs.src)
        })
        const array=[]
        let primoH3
        let h
        if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').text()!==""){
            if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').eq(0).text()==="Indice"){
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').eq(1)
            }else{
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2').eq(0)
            }
            h=(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h2'));
        }else if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').text()!==""){
            if(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').eq(0).text()==="Indice"){
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').eq(1)
            }else{
                primoH3=cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3').eq(0)
            }
            h=(cheerio.load(i.data.parse.text["*"])('div.mw-content-ltr h3'));
        }
        if(primoH3){
            const paragrafo=primoH3.prevAll("p")
            let p=""
            paragrafo.each((index, element)=>{
                p=(cheerio.load(i.data.parse.text["*"])(element).text())+" "+p;
            });
            let summary=""
            if(p!==""){
                summary=generateSummary(p)
                let titolo="In generale"
                let testo=p
                if(lingua==="en"){
                    titolo="In general"
                }
                array.push({titolo:titolo,testo:testo,riassunto:summary,img:img})
            }
        }
        if(h){
            h.each((index, element)=>{
                let titolo=(cheerio.load(i.data.parse.text["*"])(element).text().replace(/\[.*?\]/g,""));
                let testo=""
                let summary=""
                const paragraphs=cheerio.load(i.data.parse.text["*"])(element).nextUntil('h2', 'p')
                if(titolo!=="Notes"&&titolo!=="Note"&&titolo!=="Galleria d'immagini"&&titolo!=="Photo gallery"&&titolo!=="Voci correlate"&&titolo!=="References"&&titolo!=="Altri progetti"&&titolo!=="Collegamenti esterni"&&titolo!=="External links"&&titolo!=="See also"){
                    paragraphs.each((index, paragraph)=>{
                        testo=testo+" "+cheerio.load(i.data.parse.text["*"])(paragraph).text();
                    });
                    if(testo!==""){
                        summary=generateSummary(testo)
                        array.push({titolo:titolo,testo:testo,riassunto:summary,img:img})
                    }
                }
            });
            if(array.length>0){
                res.send(array)
            }else{
                error(lingua,res)
            }
        }else{
            error(lingua,res)
        }
    })
}
app.put("/wikiText", async (req,res)=>{
    let info=req.body
    if(info.wikidata){
        const response = await axios.get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks/urls&ids=${info.wikidata}`);
        const obj=response.data.entities[Object.keys(response.data.entities)].sitelinks[info.lingua+"wiki"]
        if(obj){
            axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+obj.title).then(e=>{
                if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                    text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,res,info.lingua) 
                }else{
                    error(info.lingua,res)
                }
            })
        }else{
            error(info.lingua,res)
        }
    }else if(info.lat&&info.lon){
        axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord="+info.lat+"|"+info.lon+"&gsradius=1000&redirects=true&gssearch="+info.nome).then(e=>{
            if(e.data.query.geosearch[0].pageid){
                text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&format=json&pageid="+e.data.query.geosearch[0].pageid,res,info.lingua)
            }else{
                error(info.lingua,res)
            }
        })
    }else{
        axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+info.nome).then(e=>{
            if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,res,info.lingua)
            }else{
                error(info.lingua,res)
            }
        })
    }
})
app.put("/wikiAudio", async (req,res)=>{
    let info=req.body
    fs.access(path.resolve('Voice.mp3'),fs.constants.F_OK,err=>{
        if (!err){
            fs.unlink(path.resolve('Voice.mp3'), (err) => {
                if (err) {
                    console.log(err);
                }
            });
        }
    })
    const combinedSpeech =new gTTS(info.titolo+". "+info.testo, info.lingua);
    combinedSpeech.save('Voice.mp3', function (err, result){
        if(err){ 
            res.status(203).send(err);
        }else{
            res.send("audio/"+Math.random())
        }
    });
})
app.get("/audio/:id", async (req,res)=>{
    res.sendFile(path.resolve('Voice.mp3'))
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
function generateSummary(testo){
    const frasi = testo.match(/[^\.!\?]+[\.!\?]+/g);
    const parole = testo.split(/\W+/);
    const frequenzaParole = parole.reduce((map, parola) => {
      map[parola] = (map[parola] || 0) + 1;
      return map;
    }, {});
    let riassunto=""
    if (frasi){
        const punteggioFrasi = frasi&&frasi.map(frase => {
        let punteggio = 0;
        const paroleFrase = frase.split(/\W+/);
        paroleFrase.forEach(parola => {
            punteggio += frequenzaParole[parola] || 0;
        });
        return { frase, punteggio };
        });
        riassunto = punteggioFrasi
        .sort((a, b) => b.punteggio - a.punteggio)
        .slice(0, Math.ceil(frasi.length / 4))
        .map(item => item.frase)
        .join(' ');
    }
  
    return riassunto;
}