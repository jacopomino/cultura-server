import {parentPort} from "worker_threads"
import axios from "axios"

parentPort.on("message",message=>{
    if(message.type==="start"){
        let info=message.body
        const bbox=info.latSw+","+info.lonSw+","+info.latNe+","+info.lonNe
        const query = `
        [out:json];
        (
            nwr["tourism"="attraction"](${bbox});
            nwr["tourism"="museum"](${bbox});
            nwr["tourism"="artwork"](${bbox});
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