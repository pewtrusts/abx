import Element from '@UI/element';
import s from './styles.scss';
import { stateModule as S } from 'stateful-dead';
import PS from 'pubsub-setter';
console.log(s);
const minUnitDimension = 30; // minimum px height/width accepted for touchable element
const headerHeight = 1.5 * minUnitDimension; // the height of the phase-heading bars relative to minUnitDimension
const unitPadding = 2;
const headers = [
    ['Phase 1', 'P1'],
    ['Phase 2', 'P2'],
    ['Phase 3', 'P3'],
    ['Application', 'NDA'],
    ['Approved', '&#10004']
];
const duration = 200;
var  isFirstLoad = true;



export default class VizView extends Element {
    prerender() { // this prerender is called as part of the super constructor
        /* any children need to be instatiated here */

        this.minUnitDimension = minUnitDimension;
        this.headerHeight = headerHeight;
        this.unitPadding = unitPadding;
        this.headers = headers;
        this.phaseMembers = [0,1].map(() => {
            return headers.map(() => { // will keep track of which drugs are in which column so that animations can be timed and so that 
                                       // drugs that stay in their column from one step to another can be placed before those entering the
                                       // column
                return {
                    active: [],
                    discontinued: []
                };
            });
        });   
            console.log(this.phaseMembers);                                                                    // plus one to acct fo discontinued header                     51 for totals  90 for legend 61 for sticky header 40 for toolbar
        this.heightNeeded = ( this.model.maxActive + this.model.maxDiscontinued + 1 ) * ( this.minUnitDimension + this.unitPadding ) + this.headerHeight + this.unitPadding + 51 + 90 + 61 + 40;
        //container
        var view = super.prerender();
        if (this.prerendered && !this.rerender) {
            return view; // if prerendered and no need to render (no data mismatch)
        }


        function renderColumns(cont) {
            for (let i = 0; i < 5; i++) {
                let column = document.createElement('div');
                column.classList.add(s.column);
                let placeholderNumber = cont.name === s.activeContainer ? this.model.maxActive : this.model.maxDiscontinued;
                for (let j = 0; j < placeholderNumber; j++) {
                    let placeholder = document.createElement('div');
                    placeholder.classList.add(s.drug, s.drugEmpty);
                    column.appendChild(placeholder);
                }
                cont.appendChild(column);
            }
        }

        // controls
        var controlContainer = document.createElement('div');
        controlContainer.classList.add(s.controlContainer);

            // playButton
            var playButton = document.createElement('button');
            playButton.classList.add(s.playButton);
            playButton.type = "button";
            controlContainer.appendChild(playButton);

            //years
            this.model.years.forEach((year, i) => {
                var yearButton = document.createElement('button');
                yearButton.classList.add(s.yearButton, `${ i === 0 ? s.yearButtonActive : 'nope'}`);
                yearButton.type = "button";
                yearButton.value = year;
                yearButton.textContent = year;
                controlContainer.appendChild(yearButton);
            });

        view.appendChild(controlContainer);

        // container
        var container = document.createElement('div');
        container.classList.add(s.container);
        view.appendChild(container);

        // active container
        var activeContainer = document.createElement('div');
        activeContainer.classList.add(s.activeContainer);
        activeContainer.name = s.activeContainer;
        container.appendChild(activeContainer);

        // header container
        var headerContainer = document.createElement('div');
        headerContainer.classList.add(s.headerContainer);
        headerContainer.name = s.headerContainer;
        headers.forEach(phase => {
            var headerDiv = document.createElement('div');
            headerDiv.classList.add(s.headerDiv);
            headerDiv.innerHTML = `<span class="${s.phaseFull}">${phase[0].toUpperCase()}</span><span class="${s.phaseAbbr}">${phase[1]}</span>`;
            headerContainer.appendChild(headerDiv);
        });
        container.appendChild(headerContainer);

        // discontinued container
        var discontinuedContainer = document.createElement('div');
        discontinuedContainer.classList.add(s.discontinuedContainer);
        discontinuedContainer.name = s.discontinuedContainer;
        container.appendChild(discontinuedContainer);

        // columns
        renderColumns.call(this, activeContainer);
        renderColumns.call(this, discontinuedContainer);



        return view;
    }
    populatePlaceholders(yearIndex, observation) {
        function addIdsAndClasses(placeholder, drug){
            function appendDetails(){
                var drawer = document.createElement('div');
                drawer.classList.add(s.detailDrawer);
                drawer.innerHTML = `<strong>${drug.name}</strong><br />
                                    ${drug.company}`;
                placeholder.appendChild(drawer);   
            }
            placeholder.id = drug.id;
            placeholder.classList.remove(s.drugEmpty);
            placeholder.classList.add(`${ drug.gramNegative ? s.gramNegative : 'nope' }`, `${ drug.novel ? s.novel : 'nope' }`, `${ drug.urgent ? s.urgent : 'nope' }`);
            appendDetails()
        }
        var activeContainer = document.querySelector('.' + s.activeContainer),
            discontinuedContainer = document.querySelector('.' + s.discontinuedContainer);

        // copy index 1 of phaseMembers to index 0. JSON parse/stringify to make deep copy
        this.phaseMembers[0] = JSON.parse(JSON.stringify(this.phaseMembers[1]));
        
        [activeContainer, discontinuedContainer].forEach((container, k) => {
            this.model.data[yearIndex].observations[observation].forEach((phase, i) => {
                function getPhaseMembersIndex(id){
                    return this.phaseMembers[1][i][ ( k === 0 ? 'active' : 'discontinued' ) ].indexOf(id)   
                }
                // filter drugs by whether they're active or discontinued; also sort them based on whether they were already in the column
                //  they are about to be placed in
                var filtered = phase.values.filter(d => k === 0 ? !d[this.model.years[yearIndex]][observation].isDiscontinued : d[this.model.years[yearIndex]][observation].isDiscontinued).sort((a, b) => {
                        var existingIndexA = getPhaseMembersIndex.call(this, a.id),
                            existingIndexB = getPhaseMembersIndex.call(this, b.id);
                        console.log('a existing index a, b', existingIndexA, existingIndexB);
                        if ( existingIndexB < 0 && existingIndexA >= 0 ) { // if drug is entering the column, ie, not already in it
                            return -1;
                        }
                        if (existingIndexA < 0 && existingIndexB >= 0 ) {
                            return 1;
                        }
                        if ( getPhaseMembersIndex.call(this, a.id) < getPhaseMembersIndex.call(this, b.id) ) { 
                            return -1;
                        }
                        if ( getPhaseMembersIndex.call(this, a.id) > getPhaseMembersIndex.call(this, b.id) ) { 
                            return 1;
                        }
                        return 0;
                    }),
                    column = container.querySelectorAll('.' + s.column)[i];
                console.log(filtered)
                
                // clear the phaseMember array now that its previous contents have been utilized
                this.phaseMembers[1][i][ ( k === 0 ? 'active' : 'discontinued' ) ].length = 0;
                filtered.forEach((drug, j) => {
                    var placeholder = column.querySelectorAll('.' + s.drug)[j];
                    addIdsAndClasses(placeholder, drug);
                    this.phaseMembers[1][i][ ( k === 0 ? 'active' : 'discontinued' ) ].push(drug.id); // place the drug in the proper bucket tracking its column
                });
            });
        });
        console.log(this.phaseMembers);
    }
    init() {
        PS.setSubs([
            ['resize', this.checkHeight.bind(this)],
            ['year', this.update.bind(this)]
        ]);
        S.setState('year', [this.model.years[0], null, 1]);
        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        this.checkHeight();
        this.initializeYearButtons();
        this.initializePlayButton();
    }
    initializePlayButton(){
        var playButton = document.querySelector('.' + s.playButton);
        playButton.addEventListener('click', this.playYears.bind(this));
    }
    playYears(){
        var currentYear = S.getState('year')[0],
            currentObservation = document.querySelector('.' + s.yearButtonActive).classList.contains(s.observation0) ? 0 : 1;
        function nextPromise(){
            currentYear++;
            if ( currentYear <= this.model.years[this.model.years.length - 1] ){
                new Promise(wrapperResolve => {
                    new Promise(resolve => {
                        S.setState('year', [currentYear, resolve, 0]); 
                    }).then(() => {
                        S.setState('year', [currentYear, wrapperResolve, 1])
                    });    
                }).then(() => {
                    nextPromise.call(this);
                });
            
            }
        }
        if ( currentObservation === 0 ){
            new Promise(resolve => {
                S.setState('year', [currentYear, resolve, 1]); 
            }).then(() => {
                nextPromise.call(this);
            });
        } else {
            nextPromise.call(this);
        } 

    }
    checkHeight() {

        console.log('needed', this.heightNeeded);
        console.log('available', window.innerHeight);
        /* add 'squat' class to body for small screens */
        if (window.innerHeight < this.heightNeeded) {
            document.body.classList.add(s.squat);
        } else {
            document.body.classList.remove(s.squat);
        }
        if ( document.querySelector('#section-comparison .js-inner-content').offsetHeight > window.innerHeight - 100 ) {
            document.body.classList.add(s.superSquat);
        } else {
            document.body.classList.remove(s.superSquat);
        }

        function adjustCSSVariables() {
            var root = document.documentElement;
            var activeMax = Math.floor((this.heightNeeded - this.unitPadding - this.headerHeight) * (this.maxActive / (this.maxActive + this.maxDiscontinued)));
            root.style.setProperty('--unit-dimension', this.minUnitDimension + 'px');
            root.style.setProperty('--header-height', this.headerHeight + 'px');
            root.style.setProperty('--max-container-height', this.heightNeeded + 'px');
            root.style.setProperty('--active-max-height', activeMax + 'px');
            root.style.setProperty('--discontinued-max-height', Math.floor(this.heightNeeded - activeMax - this.headerHeight) + 'px');

            /*
            :root {
                --max-container-height: 800px;
                --active-max-height: 368px;
                --discontinued-max-height: 368px;
                --squat-active-proportion: 50vh;
                --squat-discontinued-proportion: 50vh;
                --unit-dimension: 30px;
                --header-height: 45px;
            }

            */
        }
        adjustCSSVariables.call(this);
    }
    initializeYearButtons(){
        document.querySelectorAll('.' + s.yearButton).forEach(button => {
            console.log(button);
            button.addEventListener('click', function(){
                var currentYear = S.getState('year')[0];
                this.blur();
                if ( currentYear !== this.value ) { // is not the already selected button
                    let observations = this.value > currentYear ? [0,1] : [1,0];
                    
                    new Promise(resolve => {
                        S.setState('year', [this.value, resolve, observations[0]]);
                    }).then(() => {
                        S.setState('year', [this.value, null, observations[1]]);
                    });
                } else {
                    let observation = this.classList.contains(s.observation0) ? 1 : 0;
                    S.setState('year', [this.value, null, observation]);   
                }
            });
        });
    }
    update(msg,data) { // here data is an array. [0]: year; [1]: null or `resolve` from the Promise. needs to resolve true when all transitions of current update are finished . 3. observation index
        
        // find btn to be deselected and change its appearance
        let toBeDeselected = document.querySelector('.' + s.yearButtonActive);
        toBeDeselected.classList.remove(s.yearButtonActive, s.observation, s.observation0, s.observation1);
        
        // find button that matches new selection and change its appearance
        var btn = document.querySelector('button[value="' + data[0] +'"]');
        
        //toggle observation 0 or observation 1
        btn.classList.add(s.yearButtonActive);
        if ( data[2] === 0 ){
            btn.classList.remove(s.observation1);
        } else {
            btn.classList.remove(s.observation0);
        }
        btn.classList.add(s.observation, s['observation' + data[2]])
        this.FLIP(parseInt(data[0]), data[1], data[2]); // yearIndex, resolve fn, observation
        this.updateText();
    }
    updateText(){
        // phaseMembers[1] is the current state; [0] is the previous state
        
        var totalActive = this.phaseMembers[1][this.phaseMembers[1].length - 1].active.length,
            totalDiscontinued = this.phaseMembers[1].reduce((acc,cur) => {
                return acc + cur.discontinued.length;
            },0),
            approvedSpan = document.querySelector('#total-approved'),
            discontinuedSpan = document.querySelector('#total-discontinued');
        if ( approvedSpan.innerHTML != totalActive) {
            document.querySelector('#total-approved').fadeInContent(totalActive);
        }
        if ( discontinuedSpan.innerHTML != totalDiscontinued ) {
            document.querySelector('#total-discontinued').fadeInContent(totalDiscontinued);
        }
    }
    FLIP(data, resolve, observation = 1){ // obnservation defaults to 1 for the initial page load animation
        this.recordFirstPositions(); // first positions on page
        this.clearAttributesAndDetails(); // removes classNames and IDs of nonempty drug

        // params 1. index of the year (2014 -> 0); 2. index of the observation; 
        this.populatePlaceholders(this.model.years.indexOf(data), observation); // last  

        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        console.log(this.nonEmptyDrugs);
        this.invertPositions();
        this.recordStatuses(data, observation);
        //setTimeout(() => {
             this.playAnimation(resolve); // pass in the `resolve` function from the promise initiated when the year button was pressed or Play loop cycled
        //});

        // record status of the drugs so that the next cycle can be compared to the previous and the animations sequenced properly
        
     
    }
    recordStatuses(year, observation){
        console.log(year,observation, this.model);
        this.previousStatuses = this.model.data[this.model.years.indexOf(year)].observations[observation].reduce((acc, phase) => { // cur is the phase object
                phase.values.forEach(drug => {
                    acc[drug.id] = {
                        column: drug[year][observation].column,
                        isDiscontinued: drug[year][observation].isDiscontinued
                    };
                })
            return acc;
        },{});
        console.log(this.previousStatuses);
    }
    recordFirstPositions(){
        this.firstPositions = Array.from(document.querySelectorAll('.' + s.drug + ':not(' + s.drugEmpty + ')')).reduce((acc, cur) => {
            
            acc[cur.id] = cur.getBoundingClientRect();
            return acc;
        },{});
    }
    clearAttributesAndDetails(){
        this.nonEmptyDrugs.forEach(drug => {
            var details = drug.querySelector('.' + s.detailDrawer);
            drug.className =  `${s.drug} ${s.drugEmpty}`;
            drug.id = '';
            drug.removeChild(details);
        });
    }
    invertPositions(){
        this.nonEmptyDrugs.forEach(drug => {
            drug.style.transitionDuration = '0s';
            var lastPosition = drug.getBoundingClientRect(),
                deltaY = this.firstPositions[drug.id] ? this.firstPositions[drug.id].top - lastPosition.top : -1000,
                deltaX = this.firstPositions[drug.id] ? this.firstPositions[drug.id].left - lastPosition.left : -1000; // drugs that are entering will not have firstPositions
            drug.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            if ( !this.firstPositions[drug.id] ){
                drug.classList.add(s.entering);
            }
        });
    }
    playAnimation(resolve){
        var column = headers.length;
            

       
        function resolveTrue(duration){
            if (resolve) {
                setTimeout(function() {
                    resolve(true);
                }, duration);
            }
        }
        function transition(DOMDrug){
            DOMDrug.style.transitionDuration = duration / 1000 + 's';
            setTimeout(() => {
              DOMDrug.style.transform = 'translate(0px,0px)';
            });      
        }
        function animateSingleColumn(resolve){
            console.log('foo', column);
            var matchingDrugIDs = Object.keys(this.previousStatuses).filter(id => this.previousStatuses[id].column === column);
            var matchingDOMDrugs = Array.from(this.nonEmptyDrugs).filter(DOMDrug => matchingDrugIDs.includes(DOMDrug.id));
           
            matchingDOMDrugs.forEach(DOMDrug => {
                transition(DOMDrug);
            });
            if ( column > 0 ){
                setTimeout(() => {
                    column--;
                    animateSingleColumn.call(this, resolve);
                }, duration * 2);
            } else {
                setTimeout(function(){
                    console.log('foo', 'resolve!')
                   resolve(true);  
                }, duration);
            }
        }
        if ( isFirstLoad ){ // ie is  the first animation on load FIRST ANIMATION

            console.log('first load!', this.nonEmptyDrugs);
            this.nonEmptyDrugs.forEach((DOMDrug, i) => {
                setTimeout(function(){
                    transition(DOMDrug);
                }, i * 10);
            });
            isFirstLoad = false;
       //     resolveTrue(duration); */
        } else { // is not the first animation on load, ie drugs have previous statuses SUBSEQUENT ANIMATIONS
            let enteringDrugs = Array.from(this.nonEmptyDrugs).filter(DOMDrug => !Object.keys(this.previousStatuses).includes(DOMDrug.id));
            enteringDrugs.forEach(enteringDrug => {
                this.previousStatuses[enteringDrug.id] = {
                    column: 0,
                    isDiscontinued: false
                };
            });
            console.log(column, animateSingleColumn);
            new Promise(resolve => {
                animateSingleColumn.call(this, resolve);
            }).then(function(){
                resolveTrue(0);
            });
        }
        
        /*(console.log(this.phaseMembers);
        const increment = 50;
        var delay;
        [4,3,2,1,0].forEach((phase, index) => {
            if ( index === 0 ){
                delay = 0;
            }
            else {
                delay = this.phaseMembers[0][phase + 1].active.concat(this.phaseMembers[0][phase + 1].discontinued).length * increment + 500 + increment;
            }
            setTimeout(() => {
                this.phaseMembers[0][phase].active.concat(this.phaseMembers[0][phase].discontinued).forEach((each, j) => {
                    var el = document.querySelector('div#' + each );
                    setTimeout(() => {
                        el.style.transitionDuration = '0.5s';
                        el.style.transform = 'translate(0,0)';
                    }, increment * j);
                });
            }, delay);
        });
        document.querySelectorAll('.' + s.entering).forEach(drug => {
            drug.style.transitionDuration = '0.5s';
            drug.style.transform = 'translate(0,0)';
        });*/
        
/****  TO DO ******

assign classNames to drugs according to which way they are moving. progressing, regressing, discontinuing, entering, reentering
probably done up in loop starting an ln 141.

        var animate = new Promise(function(resolve) {
            ['foo','bar'].forEach((baz,i,array) => {
                setTimeout(function(){
                    console.log(baz);
                    if ( i === array.length - 1 ){
                        resolve(true);
                    }
                }, 1000 * i);
            });
        });
        
        animate.then(() => {
            console.log('resolved');
        });
        /*  setTimeout(function(){ // transition won't happen w/o the setTimeout trick
              drug.style.transitionDuration = '0.8s';
              drug.style.transform = 'translate(0,0)';
              ***** HERE *** CYCLE THROUGH columns one by one
              document.querySelectorAll('.src-views-viz-view--column')[0].querySelectorAll('.src-views-viz-view--drug').forEach(drug => {drug.style.transitionDuration = '0.8s';drug.style.transform = 'translate(0,0)';});
          });*/
    }
}