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
import VizView from './views/viz-view/';
//import FiftyStateView from './views/fifty-state/';

// app prototype
import PCTApp from '@App';

//static content
import sections from './partials/sections.html';
import intro from './partials/intro.md';
import notes from './partials/notes.md';


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
                views.length = 0;  
                model.years = [2014];
                // find number of years in data. relies on all rows having the same number
                var loopWhile = true,
                index = 0;

                while ( loopWhile ){
                    if ( response.data[0].hasOwnProperty(model.years[0] + index) ) {
                        model.years.push(model.years[0] + index);   
                    } else {
                        loopWhile = false;
                    }
                    index++
                }

                model.data = model.years.map(year => {
                    return {
                        year,
                        values: [1,2,3,4,5].map(phase => {
                            return {
                                phase,
                                values: response.data.filter(d => {
                                        d[year] = d[year][0] === '[' ? JSON.parse(d[year]) : d[year];
                                        d.isDiscontinued = ( d[year].toString().indexOf('d') !== -1 ); 
                                        return parseInt(d[year]) === phase;
                                    })
                            };
                        })
                    };
                });

                const discontinuedLengths = [];
                // find the maximum number of nondiscontinued drugs in one column at any time. side effect pushes 
                // number of discontinued drugs to array for max tbd later
                // these values will be used to determine when stacked drugs need to be collapsed down
                // for smaller screens
                model.maxActive = Math.max(...model.data.map(year => Math.max(...year.values.map(phase => {
                    discontinuedLengths.push(phase.values.filter(each => each.isDiscontinued).length);
                    return phase.values.filter(each => !each.isDiscontinued).length;
                }))));
                model.maxDiscontinued = Math.max(...discontinuedLengths);
               
                console.log(model);
               
                /* push views now that model is complete */
                
                views.push(
                   this.createComponent(model, VizView, 'div#viz-view', {renderToSelector: '#abx-visualization', rerenderOnDataMismatch: true, parent: this})
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
        this.el.insertAdjacentHTML('beforeend', sections);
        document.querySelector('#intro').insertAdjacentHTML('afterbegin', intro );
        document.querySelector('#abx-notes').insertAdjacentHTML('afterbegin', notes );
        //this.wasPrerendered = false;
        getRuntimeData.call(this).then(() => { // bind StateDebt as context `this` for getRuntimeData so that it can acceess this.el, etc
            
            views.forEach(view => {
                console.log(view);
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