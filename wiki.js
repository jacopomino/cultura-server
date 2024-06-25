import {parentPort} from "worker_threads"
import axios from "axios"

async function fetchImage(wikidataId) {
    const query = `
        SELECT ?image WHERE {
            wd:${wikidataId} wdt:P18 ?image.
        }
    `;
    const url = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
    try {
        const response = await axios.get(url);
        const bindings = response.data.results.bindings;
        if (bindings.length > 0) {
            return bindings[0].image.value;
        }
    } catch (error) {
        //console.error('Error fetching image from Wikidata:', error);
    }
    return null;
}

parentPort.on("message",message=>{
    if(message.type==="start"){
        let info=message.body
        const query = `
        [out:json];
        (
        nwr["tourism"="attraction"](around:`+info.raggio+`,`+info.lat+`,`+info.lon+`);
        nwr["tourism"="museum"](around:`+info.raggio+`,`+info.lat+`,`+info.lon+`);
        nwr["tourism"="artwork"](around:`+info.raggio+`,`+info.lat+`,`+info.lon+`);
        );
        out geom;
        `
        axios.post('https://overpass-api.de/api/interpreter', query).then(async response => {
            parentPort.postMessage(response.data.elements.filter(i=>i.tags.name&&(i.tags.wikipedia||i.tags.wikidata)));
            for (let element of response.data.elements.filter(i => i.tags.name && (i.tags.wikipedia || i.tags.wikidata))) {
                let imageUrl = null;
                if (element.tags.wikidata) {
                    imageUrl = await fetchImage(element.tags.wikidata);
                } else if (element.tags.wikipedia) {
                    const wikidataId = element.tags.wikipedia.split(':')[1];
                    imageUrl = await fetchImage(wikidataId);
                }
                if (imageUrl) {
                    element.imageUrl = imageUrl;
                }
            }
        }).catch(error => {
            parentPort.postMessage({type:"error",error:error});
            console.error('Errore durante la richiesta Overpass:', error);
        });
    }
})
