/* global PUBLICPATH process */
//utils
//import * as d3 from 'd3-collection';
import Papa from 'papaparse';
import { stateModule as S } from 'stateful-dead';
//import PS from 'pubsub-setter';
import { publishWindowResize } from '@Utils';

//data ( CSVs loaded by file-loader for use by Papaparse at build and runtime. that's set in webpack.common.js )
import data from './data/abx-data.csv';

//views
//import ComparisonView from './views/state-comparison/';
//import FiftyStateView from './views/fifty-state/';

// app prototype
import PCTApp from '@App';

//static content
//import sections from './partials/sections.html';
//import footer from './partials/footer.html';

publishWindowResize(S); // initialize publish window resize with StateMOdule as param/

const model = {
    // any static data should be made properties of the model now
    
};

const views = []; // views get push  nly after model is fully ready, with any runtime data loaded

function getRuntimeData(){
    var publicPath = '';
    if ( process.env.NODE_ENV === 'production' && !window.IS_PRERENDERING ){ // production build needs to know the public path of assets
                                                                             // for dev and preview, assets are a child of root; for build they
                                                                             // are in some distant path on sitecore
        publicPath = PUBLICPATH; // TODO: set PUBLICPATH using define plugin in webpack.build.js
    }
    return new Promise((resolve, reject) => {
        var appContainer = this.el;
        Papa.parse(publicPath + data, {
            download: true,
            dynamicTyping: true,
            header: true,
            fastMode: false, // string escapes needed to parse sringified arrays with commas
            skipEmptyLines: true,
            beforeFirstChunk(chunk){ // on prerender, do simple hash of CSV contents and append as attribute of the app container
                                     // at runtime, do same hash of csv contents and compare to original. if hashes match, app will
                                     // continue normally. if mismatched, app will rerender all components based on the new data.
                                     // this allows for `hot` updating of the main data file without rebuilding the dist/ folder.
                                     // `model.isMismatch` will be set to `true` and the prerendering functions will check that value
                                     // and respond accordingly

                var dataHash = chunk.hashCode(); // hashCode is helper function from utils, imported and IIFE'd in index.js
                if ( window.IS_PRERENDERING ){
                    appContainer.setAttribute('data-data-hash', dataHash);
                } else if ( process.env.NODE_ENV !== 'development' && dataHash.toString() !== appContainer.getAttribute('data-data-hash') ){
                    appContainer.setAttribute('data-data-mismatch',true);
                    console.log('data mismatch');
                    model.isMismatched = true; // set so that components can access this value 
                }
            },
            complete: response => { // arrow function here to keep `this` context as StateDebt
                console.log(response);
                views.length = 0;  // HERE YOU NEED TO NEST BY USING THE THE GROUP THAT THE VALUE MAPS TO
                model.data = response.data.map(d => {
                    console.log(d);
                    Object.keys(d).forEach(key => {
                        d[key] = d[key][0] === '[' ? JSON.parse(d[key]) : d[key];
                    });
                    return d;
                });
                console.log(model.data);
                //var data = response.data;
                /* complete model based on fetched data */

                /* any grouping, summarizing or manipulating of the data to be done here */
             /*   model.data = data;
                model.types.forEach(type => {
                    if ( type.type !== 'text'){
                        let dataArray = data.map(d => d[type.field]).filter(d => d !== null); 
                        type.max = Math.max(...dataArray);
                        type.min = Math.min(...dataArray);
                        type.spread = type.max - type.min ;
                    }
                });
                model.typesNested = d3.nest().key(d => d.group).entries(model.types);
                console.log(model);
                // ....
               */
                /* push views now that model is complete */
                
                views.push(
                   // this.createComponent(model, ComparisonView, 'div#comparison-view', {renderToSelector: '#section-comparison .js-inner-content', rerenderOnDataMismatch: true, parent: this}),  
                   // this.createComponent(model, FiftyStateView, 'div#fifty-state-view', {renderToSelector: '#section-states .js-inner-content', rerenderOnDataMismatch: true, parent: this})  
                );
                
                resolve(true);
            },
            error: function(error){
                reject(error);
            }
        });
    });
}

export default class ABXApp extends PCTApp {
    prerender(){

        //indsert any static content here
//        this.el.insertAdjacentHTML('beforeend', sections);
//       this.el.insertAdjacentHTML('beforeend', footer);
        //this.wasPrerendered = false;
        getRuntimeData.call(this).then(() => { // bind StateDebt as context `this` for getRuntimeData so that it can acceess this.el, etc
            
            views.forEach(view => {
          /* ? */      view.container.appendChild(view.el); // different here from CapeTown: views aren't appended to app container; some static content
                                                     // is present already. views appended to *their* containers
            });
            //this.container.classList.add('rendered');
        });
    }
    init(){
        super.init();
       // this.attachSectionOpenClose();
        getRuntimeData.call(this).then(() => {
            views.forEach(view => {
               view.init(this);                    
            });
        });                                

/*        if ( module.hot ){
            let that = this;
            module.hot.accept('./views/state-comparison', () => {
                console.log('accept!', arguments, that);
                document.querySelector('#section-comparison .js-inner-content').innerHTML = '';
                var replacement = that.createComponent(model, ComparisonView, 'div#comparison-view', {renderToSelector: '#section-comparison .js-inner-content', rerenderOnDataMismatch: true});
                console.log(replacement);
                replacement.container.appendChild(replacement.el);

            });
        } */
    }
}