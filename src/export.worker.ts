import {svg} from './export';
import type {Element} from './model';
self.onmessage=(event:MessageEvent<{elements:Element[];background:string}>)=>{
 try{self.postMessage({svg:svg(event.data.elements,event.data.background)})}
 catch(error){self.postMessage({error:error instanceof Error?error.message:'Export failed'})}
};
