import {parentPort} from "worker_threads"
import axios from "axios"
import cheerio from "cheerio"

parentPort.on("message",async(message)=>{
    if(message.type==="start"){
        let info=message.body
        if(info.wikidata){
            const response = await axios.get(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks/urls&ids=${info.wikidata}`);
            const obj=response.data.entities[Object.keys(response.data.entities)].sitelinks[info.lingua+"wiki"]
            if(obj){
                axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+obj.title).then(e=>{
                    if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                        text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,info.lingua) 
                    }else{
                        error(info.lingua)
                    }
                })
            }else{
                error(info.lingua)
            }
        }else if(info.lat&&info.lon){
            axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord="+info.lat+"|"+info.lon+"&gsradius=1000&redirects=true&gssearch="+info.nome).then(e=>{
                if(e.data.query.geosearch[0]){
                    text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&format=json&pageid="+e.data.query.geosearch[0].pageid,info.lingua)
                }else{
                    error(info.lingua)
                }
            })
        }else{
            axios.get("https://"+info.lingua+".wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&redirects=true&titles="+info.nome).then(e=>{
                if(e.data.query.pages[Object.keys(e.data.query.pages)].pageid){
                    text("https://"+info.lingua+".wikipedia.org/w/api.php?action=parse&format=json&pageid="+e.data.query.pages[Object.keys(e.data.query.pages)].pageid,info.lingua)
                }else{
                    error(info.lingua)
                }
            })
        }
    }
})
//funzione per gestire errori
const error=(lingua)=>{
    let titolo="In generale"
    let testo="Non trovo informazioni a riguardo"
    let summary="Non trovo informazioni a riguardo"
    if(lingua==="en"){
        titolo="In general"
        testo="I can't find any information about it"
        summary="I can't find any information about it"
    }
    parentPort.postMessage({type:"error",error:[{titolo:titolo,testo:testo,riassunto:summary}]})
}
//funzione per ottenere il testo in base alla pagina da analizzare
const text=(url,lingua)=>{
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
                parentPort.postMessage(array)
            }else{
                error(lingua)
            }
        }else{
            error(lingua)
        }
    })
}
function generateSummary(testo){
    const frasi = testo.match(/[^\.!\?]+[\.!\?]+/g);
    const parole = testo.split(/\W+/);
    const frequenzaParole = parole.reduce((map, parola) => {
        map[parola] = (map[parola] || 0) + 1;
        return map;
    }, {});
    let riassunto = "";
    if (frasi) {
        const punteggioFrasi = frasi && frasi.map(frase => {
            let punteggio = 0;
            const paroleFrase = frase.split(/\W+/);
            paroleFrase.forEach(parola => {
                punteggio += frequenzaParole[parola] || 0;
            });
            return { frase, punteggio };
        });
        punteggioFrasi.sort((a, b) => b.punteggio - a.punteggio);

        let paroleRiassunto = 0;
        let i = 0;
        while(paroleRiassunto < 60 && i < punteggioFrasi.length) {
            const paroleFrase = punteggioFrasi[i].frase.split(/\W+/);
            if (paroleRiassunto + paroleFrase.length <= 100) {
                riassunto += punteggioFrasi[i].frase + ' ';
                paroleRiassunto += paroleFrase.length;
            }
            i++;
        }
    }
    return riassunto.trim();
}
