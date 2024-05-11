import {parentPort} from "worker_threads"
import axios from "axios"

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
        axios.post('https://overpass-api.de/api/interpreter', query).then(response => {
            parentPort.postMessage(response.data.elements.filter(i=>i.tags.name&&(i.tags.wikipedia||i.tags.wikidata)));
        }).catch(error => {
            console.error('Errore durante la richiesta Overpass:', error);
        });
    }
})
