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
            console.log(this.phaseMembers);                                                                    // plus one to acct fo discontinued header
        this.heightNeeded = ( this.model.maxActive + this.model.maxDiscontinued + 1 ) * ( this.minUnitDimension + this.unitPadding ) + this.headerHeight + this.unitPadding;
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
        var currentYear = S.getState('year');
        new Promise(resolve => {
            S.setState('year', [currentYear + 1, resolve]);
        });

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
                    let toBeDeselected = document.querySelector('.' + s.yearButtonActive);
                    toBeDeselected.classList.remove(s.yearButtonActive, s.observation, s.observation0, s.observation1);
                    this.classList.add(s.yearButtonActive);
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
        var btn = document.querySelector('button.' + s.yearButtonActive);
        this.FLIP(parseInt(data[0]), data[1], data[2]);
        if ( data[2] === 0 ){
            btn.classList.remove(s.observation1);
        } else {
            btn.classList.remove(s.observation0);
        }
        btn.classList.add(s.observation, s['observation' + data[2]])
    }
    FLIP(data, resolve, observation = 1){ // obnservation defaults to 1 for the initial page load animation
        this.recordFirstPositions(); // first
        this.clearAttributesAndDetails();

        // params 1. index of the year (2014 -> 0); 2. index of the observation; 
        this.populatePlaceholders(this.model.years.indexOf(data), observation); // last  
        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        console.log(this.firstPositions);
        //setTimeout(() => {
            this.invertPositions();
            this.playAnimation(resolve); // pass in the `resolve` function from the promise initiated when the year button was pressed or Play loop cycled
        //    }, 3000); // invert and play
        // ***** TO DO ****** INVERSION isn't working properly. need to remove classes *and* remove details drawers before repopulating
        // the placeholders. why is there a transition on the invert? are the id's being assign properly?
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
        const duration = 500;
        this.nonEmptyDrugs.forEach(drug => {
            drug.style.transitionDuration = ( duration / 1000 ) + 's';
            drug.style.transform = 'translate(0,0)';
        });
        if (resolve) {
            setTimeout(function() {
                resolve(true);
            }, duration);
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