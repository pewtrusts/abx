import Element from '@UI/element';
import s from './styles.scss';
import { stateModule as S } from 'stateful-dead';
import PS from 'pubsub-setter';
import tippy from 'tippy.js';
import './tippy-styles.scss';
import { GTMPush } from '@Utils';

const minUnitDimension = 30; // minimum px height/width accepted for touchable element
const headerHeight = 1.5 * minUnitDimension; // the height of the phase-heading bars relative to minUnitDimension
const unitPadding = 2;
const headers = [
    ['Phase 1', 'P1'],
    ['Phase 2', 'P2'],
    ['Phase 3', 'P3'],
    ['Application', 'NDA'],
    ['Approved', '&#x2713']
];

const duration = 1200;

var isFirstLoad = true;

function arrayFromNumber(num, value){
    var arr = [];
    for ( let i = 0; i < num; i++){
        arr.push(value);
    }
    return arr;
}

export default class VizView extends Element {
    prerender() { // this prerender is called as part of the super constructor
        /* any children need to be instatiated here */

        this.minUnitDimension = minUnitDimension;
        this.headerHeight = headerHeight;
        this.unitPadding = unitPadding;
        this.headers = headers;
        this.phaseMembers = [0,1].map(() => {
            return [0, ...headers].map(d => { // will keep track of which drugs are in which column so that animations can be timed and so that 
                                       // drugs that stay in their column from one step to another can be placed before those entering the
                                       // column
                return {
                    active: d === 0 ? this.model.unnestedData.map(drug => drug.id) : [],
                    discontinued: []
                };
            });
        });
          
        this.heightNeeded = ( this.model.maxActive + this.model.maxDiscontinued + 1 ) * ( this.minUnitDimension + this.unitPadding ) + this.headerHeight + this.unitPadding + 200;
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
            playButton.title = 'Play';
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

            //animate on/off
            var inputWrapper = document.createElement('div');
            inputWrapper.classList.add(s.inputWrapper);
            
            var input = document.createElement('input');
            input.classList.add('js-animate-checkbox');
            input.setAttribute('type', 'checkbox');
            input.setAttribute('checked', 'checked');
            input.id = 'toggle-animate-on-off';

            var label = document.createElement('label');
            label.classList.add(s.inputLabel);
            label.setAttribute('for', 'toggle-animate-on-off');
            label.textContent = 'Animate change';

            inputWrapper.appendChild(input);
            inputWrapper.appendChild(label);
            controlContainer.appendChild(inputWrapper);



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
    init() {
        PS.setSubs([
            ['resize', this.checkHeight.bind(this)],
            ['year', this.update.bind(this)],
          //  ['isBackward', this.toggleIsBackward.bind(this)],
           // ['isSameYear', this.toggleIsSameYear.bind(this)]
        ]);
        this.columns = {};
        this.columns.active = document.querySelector('.' + s.activeContainer).querySelectorAll('.' + s.column);
        this.columns.discontinued = document.querySelector('.' + s.discontinuedContainer).querySelectorAll('.' + s.column);
        this.positionMap = {
            active: headers.map(() => arrayFromNumber(this.model.maxActive, 'empty')),
            discontinued: headers.map(() => arrayFromNumber(this.model.maxDiscontinued, 'empty'))
        };
        console.log(this.positionMap);
        S.setState('year',{ year: this.model.years[0], resolve: null, source: 'load'});
       // this.setYearState([this.model.years[0], null, 0]);
        
        this.checkHeight();
        this.initializeYearButtons();
        this.initializeAnimateOnOff();
        this.initializePlayButton();
    }
    update(msg,data) { // here data is an array. [0]: year; [1]: null or `resolve` from the Promise. needs to resolve true when all transitions of current update are finished . 3. observation index
        
        // find btn to be deselected and change its appearance
        var toBeDeselectedActive = document.querySelector('.' + s.yearButtonActive);        //observationToCheckAgainst = !S.getState('isBackward') ? 0 : 1;
        toBeDeselectedActive.classList.remove(s.yearButtonActive, s.observation, s.observation0, s.observation1)
        
        // find button that matches new selection and change its appearance
        var btn = document.querySelector('button[value="' + data.year +'"]');
        
        //toggle observation 0 or observation 1
        btn.classList.add(s.yearButtonActive);
      
        if ( data.source === 'load' ){
            this.populateInitialDrugs(data.year);
        }
        if ( data.source === 'yearButton' ){
            this.switchYears(data);
        }
        //this.FLIP(parseInt(data[0]), data[1], data[2]); // yearIndex, resolve fn, observation
       // this.updateText();
    }
    addIdsAndClasses(placeholder, drug){
        placeholder.id = drug.id;
        placeholder.classList.remove(s.drugEmpty);
        placeholder.classList.add(`${ drug.gramNegative ? s.gramNegative : 'nope' }`, `${ drug.novel ? s.novel : 'nope' }`, `${ drug.urgent ? s.urgent : 'nope' }`);//, `${ previousStatuses && previousStatuses[drug.id] && previousStatuses[drug.id].isDiscontinued && !drug[model.years[yearIndex]].isDiscontinued ? s.wasDiscontinued : 'nope'}`);
        if ( isNaN(drug.value) ){
            placeholder.classList.add(s.isDiscontinued);
        }
        placeholder.setAttribute('data-tippy-content',`<strong>${drug.name}</strong><br />${drug.company}`);
    }
    populateInitialDrugs(year){
        var yearMatches = this.model.normalized.filter(d => d.year === year);
        ['active','discontinued'].forEach((type, i) => {
            var typeMatches = i === 0 ? yearMatches.filter(d => !isNaN(d.value)) : yearMatches.filter(d => isNaN(d.value));
            headers.forEach((phase, j) => {
                var phaseMatches = typeMatches.filter(d => parseInt(d.value) === j + 1);
                console.log(phaseMatches);
                phaseMatches.forEach((drug, k) => {
                    this.addIdsAndClasses(this.columns[type][j].children[k], drug);
                });
            });
        });
        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        tippy(this.nonEmptyDrugs,{
            arrow: true,
            distance: 3
        });
        this.mapPositions()
    }
    mapPositions(){

    }
    switchYears(){

    }
    initializeYearButtons(){
        document.querySelectorAll('.' + s.yearButton).forEach(button => {
            
            var _this = this;
            button.addEventListener('click', function(){
                var currentYear = S.getState('year')[0];
                if ( currentYear != this.value ) { // is not the already selected button
                    GTMPush('ABXAnimation|Year|' + this.value);
                    S.setState('isPaused', false);
                    this.blur();
                    _this.disablePlayButton();
                    _this.removeReplayOption();
                    if ( +this.value > +currentYear ) {
                        S.setState('isBackward', false);
                        new Promise(() => {
                            S.setState('year', {year: this.value, resolve: null, source: 'yearButton'});
                        });
                    } else {
                        S.setState('isBackward', true);
                        new Promise(() => {
                            S.setState('year', {year: this.value, resolve: null, source: 'yearButton'});
                        })
                    }
                }
            });
        });
    }
    populatePlaceholders(yearIndex, observation) {
        console.log(this.previousStatuses);

        function addIdsAndClasses(placeholder, drug, containerIndex, previousStatuses, model){
            placeholder.id = drug.id;
            placeholder.classList.remove(s.drugEmpty);
            placeholder.classList.add(`${ drug.gramNegative ? s.gramNegative : 'nope' }`, `${ drug.novel ? s.novel : 'nope' }`, `${ drug.urgent ? s.urgent : 'nope' }`, `${ previousStatuses && previousStatuses[drug.id] && previousStatuses[drug.id].isDiscontinued && !drug[model.years[yearIndex]].isDiscontinued ? s.wasDiscontinued : 'nope'}`);
            if ( containerIndex === 1 ){
                placeholder.classList.add(s.isDiscontinued);
            }
            placeholder.setAttribute('data-tippy-content',`<strong>${drug.name}</strong><br />${drug.company}`);
        }

        var activeContainer = document.querySelector('.' + s.activeContainer),
            discontinuedContainer = document.querySelector('.' + s.discontinuedContainer);

        // copy index 1 of phaseMembers to index 0. JSON parse/stringify to make deep copy
        this.phaseMembers[0] = JSON.parse(JSON.stringify(this.phaseMembers[1]));
        console.log(this.phaseMembers, this.previousStatuses);
        [activeContainer, discontinuedContainer].forEach((container, k) => {
            var isDiscontinued = k === 0 ? false : true;

            this.model.data[yearIndex].observations[observation].forEach((phase, i) => {
                function getPhaseMembersIndex(id){
                    return this.phaseMembers[1][i + 1][( isDiscontinued ? 'discontinued' : 'active' )].indexOf(id)   
                }
                // filter drugs by whether they're active or discontinued; also sort them based on whether they were already in the column
                //  they are about to be placed in
                var filtered = phase.values.filter(d => k === 0 ? !d[this.model.years[yearIndex]][observation].isDiscontinued : d[this.model.years[yearIndex]][observation].isDiscontinued).sort((a, b) => {
                       
                       /* ENTERING / NOT ENTERING */
                       if (this.previousStatuses === undefined ){ // should be true only on first load
                           return a.id - b.id; // lower ids first
                       }

                       if ( !this.previousStatuses[a.id] && !this.previousStatuses[b.id] ){ // both are entering. coercing !true to catch undefined or zero
                           return a.id - b.id;  // lower ids first
                       }

                       if ( !this.previousStatuses[a.id] ) { // a is entering but b is not. coercing !true to catch undefined or zero
                            return 1;
                       }

                       if ( !this.previousStatuses[b.id] ) { // b is entering but a is not. coercing !true to catch undefined or zero
                            return -1;
                       }

                       /* STAYING IN COLUMN / NOT STAYING IN COLUMN */
                                                                    // .column is 1-indexed, i is zero indexed
                       if ( this.previousStatuses[a.id].column === i + 1 && this.previousStatuses[a.id].isDiscontinued === isDiscontinued ) { // a is in current column and matches current discontinued state
                            if ( this.previousStatuses[b.id].column === i + 1 && this.previousStatuses[b.id].isDiscontinued === isDiscontinued ) { // also true for b 
                                // i.e. BOTH ARE IN SAME COLUMN
                                return getPhaseMembersIndex.call(this, a.id) < getPhaseMembersIndex.call(this, b.id) ? -1 : 1;
                            }
                            // not also true for b
                            return -1;
                       }
                       if ( this.previousStatuses[b.id].column === i + 1 && this.previousStatuses[b.id].isDiscontinued === isDiscontinued ) { // b is in current column and matches current discontinued state. not true for a
                            return 1;
                       }
                       if ( this.previousStatuses[a.id].column === i + 1 ){ // A is in current column but changing status
                            if ( this.previousStatuses[b.id].column === i + 1 && this.previousStatuses[b.id].isDiscontinued !== isDiscontinued ){ // same is true for B
                                return a.id - b.id;
                            }
                            if ( this.previousStatuses[b.id].column === i + 1 ){ // B is also in current column but is not changing status
                                return 1;
                            } else {
                                return -1;
                            }
                       }
                       if ( this.previousStatuses[b.id].column === i + 1 ) {
                            return 1;
                       }

                       // process of elimination, below both a and b have been present but are coming from columns other than the current
                       if ( this.previousStatuses[a.id].column > this.previousStatuses[b.id].column ) { // sort drugs coming from greater columns first
                            return -1;
                       }
                       if ( this.previousStatuses[a.id].column < this.previousStatuses[b.id].column ) { // sort drugs coming from lesser columns last
                            return 1;
                       }
                       // process of elimination, below both and b coming from the same column
                       if ( this.previousStatuses[a.id].isDiscontinued === isDiscontinued && this.previousStatuses[b.id].isDiscontinued !== isDiscontinued ) { // A was discontinued/notDiscontinued; B was not
                            return -1;
                       }
                       if ( this.previousStatuses[b.id].isDiscontinued === isDiscontinued && this.previousStatuses[a.id].isDiscontinued !== isDiscontinued ) { // B was discontinued/notDiscontinued; A was not
                            return 1;
                       }
                       return a.id - b.id; // lower ids first
                    }),
                    column = container.querySelectorAll('.' + s.column)[i];
                
                
                // clear the phaseMember array now that its previous contents have been utilized
                this.phaseMembers[1][i + 1][ ( k === 0 ? 'active' : 'discontinued' ) ].length = 0;
                filtered.forEach((drug, j) => {
                    var placeholder = column.querySelectorAll('.' + s.drug)[j];
                    addIdsAndClasses(placeholder, drug, k, this.previousStatuses, this.model);
                    this.phaseMembers[1][i + 1][ ( k === 0 ? 'active' : 'discontinued' ) ].push(drug.id); // place the drug in the proper bucket tracking its column
                });
                this.phaseMembers[1][0].active = this.model.unnestedData.filter(d => d[+this.currentYear][this.currentObservation].column === 0).map(each => each.id);
             //   console.log(this.phaseMembers);
            });
        });
        
    }
    setYearState(data, isRestart){
        var stateBeforeChange = S.getState('year');
        if ( stateBeforeChange && !isRestart ){
            this.recordStatuses(stateBeforeChange[0], stateBeforeChange[2]);
        }
        S.setState('year', data);
        this.currentYear = data[0];
        this.currentObservation = data[2];

    }
    
   /* toggleIsSameYear(msg,data){
        var container = this.controlContainer || document.querySelector('.' + s.controlContainer);
        if ( data ){
            container.classList.add(s.isSameYearSelected);
        } else {
            container.classList.remove(s.isSameYearSelected);
        }
    }*/
  /*  toggleIsBackward(msg, data){
        var container = this.controlContainer || document.querySelector('.' + s.controlContainer);
        if ( data ){
            container.classList.add(s.isMovingBackward);
        } else {
            container.classList.remove(s.isMovingBackward);
        }
    }*/
    initializeAnimateOnOff(){
        this.animateYears = true;
        function handler(el){
            if ( el.checked ){
                GTMPush('ABXAnimation|ToggleAnimation|On');
                this.animateYears = true;
            } else {
                GTMPush('ABXAnimation|ToggleAnimation|Off');
                this.animateYears = false;
            }
            console.log(this);
        }
        var input = document.querySelector('.js-animate-checkbox');
        var handlerBind = handler.bind(this);
        input.addEventListener('change', function(){
            handlerBind(this);
        });
    }
    initializePlayButton(){
        this.playYearsBind = this.playYears.bind(this);
        var playButton = document.querySelector('.' + s.playButton);
        playButton.addEventListener('click', this.playYearsBind);
    }
    pausePlay(){
        var previousYearButton = document.querySelector('.' + s.yearButtonPrevious);
        if ( previousYearButton ){
            document.querySelector('.' + s.yearButtonPrevious).classList.remove(s.yearButtonPrevious);
        }
        this.playBtn.blur();
        this.playBtn.removeEventListener('click', this.pausePlayBind);
        S.setState('isPaused', true);
        this.playBtn.classList.add(s.willPause);
    }
    disableYearButtons(){
        this.yearButtons = this.yearButtons || document.querySelectorAll('.' + s.yearButton);
        this.yearButtons.forEach(function(btn){
            btn.setAttribute('disabled','disabled');
        });
    }
    disablePlayButton(){
        this.playBtn = this.playBtn || document.querySelector('.' + s.playButton);
        this.playBtn.setAttribute('disabled','disabled');
    }
    enablePlayButton(){
        this.playBtn = this.playBtn || document.querySelector('.' + s.playButton);
        this.playBtn.removeAttribute('disabled');
    }
    enableYearButtons(){
        this.yearButtons = this.yearButtons || document.querySelectorAll('.' + s.yearButton);
        this.yearButtons.forEach(function(btn){
            btn.removeAttribute('disabled');
        });
    }
    playYears(event){
        if ( event === 'reciprocal' ){
            GTMPush('ABXAnimation|Replay');
        } else {
            GTMPush('ABXAnimation|Play');
        }
        let thisResolveDelay = this.animateYears ? 0 : 0.625 * duration;
        S.setState('isPaused', false);
        S.setState('isBackward', false);
       // S.setState('isSameYear', false);
        this.disableYearButtons();
        this.playBtn = this.playBtn || document.querySelector('.' + s.playButton);
        this.playBtn.blur();
        function nextPromise(){
            if ( S.getState('isPaused') ){
                this.enableYearButtons();
                this.removePauseOption();
                return;
            }
            currentYear++;
            if ( currentYear <= this.model.years[this.model.years.length - 1] ){
                    new Promise(resolve => {
                        this.setYearState([currentYear, resolve, 0]); 
                    }).then(() => {
                        setTimeout(() => {
                            nextPromise.call(this);
                        }, thisResolveDelay);
                    });    
            
            } else {
                this.showReplayOption.call(this);
                this.enableYearButtons();
            }
        }

        if ( event !== 'reciprocal' ){
            this.showPauseOption();
        }
        
        var currentYear = S.getState('year')[0];
        if ( this.model.years.indexOf(+currentYear) === this.model.years.length - 1 ){
            let _duration = this.animateYears ? duration : 0.625 * duration;
            this.removeReplayOption();
            isFirstLoad = true;
            this.clearAttributesAndDetails();
            this.setYearState([this.model.years[0], null, 0], true);
            setTimeout(() => {
                this.playYears('reciprocal');
            }, _duration);
        } else {
           
                new Promise((resolve) => {
                    if ( S.getState('isPaused') ){
                        this.enableYearButtons();
                        resolve(false);
                    } else {
                        //setTimeout(() => {
                            resolve(true);
                        //}, thisResolveDelay);
                    }
                }).then(resolution => {
                    if ( !S.getState('isPaused') && resolution === true ){
                        nextPromise.call(this);
                    }
                });
        }
        

    }
    showReplayOption(){
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.removeEventListener('click', this.pausePlayBind);
        this.replayBtn.addEventListener('click', this.playYearsBind);
        this.replayBtn.classList.add(s.replay);
        this.replayBtn.classList.remove(s.pause);
        this.replayBtn.classList.remove(s.willPause);
        this.replayBtn.title = "Replay";
    }
    showPauseOption(){
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.pausePlayBind = this.pausePlay.bind(this);
        this.removeReplayOption();
        this.replayBtn.removeEventListener('click', this.playYearsBind);
        this.replayBtn.addEventListener('click', this.pausePlayBind);
        this.replayBtn.classList.add(s.pause);
        this.replayBtn.classList.remove(s.replay);
        this.replayBtn.title = "Pause";
    }
    removePauseOption(){
        console.log('removing pause option');
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.removeEventListener('click', this.pausePlayBind);
        this.replayBtn.addEventListener('click', this.playYearsBind);
        this.replayBtn.classList.remove(s.pause);
        this.replayBtn.classList.remove(s.willPause);
        this.replayBtn.title = "Play";
    }
    removeReplayOption(){
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.classList.remove(s.replay);
        //this.replayBtn.title = "Play";
    }
    checkHeight() {

        
        
        /* add 'squat' class to body for small screens */
        if (window.innerHeight < this.heightNeeded) {
            document.body.classList.add(s.squat);
        } else {
            document.body.classList.remove(s.squat);
        }
        /*if ( document.querySelector('#section-comparison .js-inner-content').offsetHeight > window.innerHeight ) {
            document.body.classList.add(s.superSquat);
        } else {
            document.body.classList.remove(s.superSquat);
        }*/

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
    updateText(){
        // phaseMembers[1] is the current state; [0] is the previous state
        var totalActive = this.phaseMembers[1][this.phaseMembers[1].length - 1].active.length,
            totalDiscontinued = this.phaseMembers[1].reduce((acc,cur) => {
                return acc + cur.discontinued.length;
            },0),
            approvedSpan = document.querySelector('#total-approved'),
            discontinuedSpan = document.querySelector('#total-discontinued'),
            year = S.getState('year')[0],
            totals = document.querySelector('#abx-totals');
        if ( +year > this.model.years[0] ){
            totals.classList.add('is-subsequent');
        } else {
            totals.classList.remove('is-subsequent');
        }
        if ( approvedSpan.innerHTML != totalActive) {
            document.querySelector('#total-approved').fadeInContent(totalActive);
        }
        if ( discontinuedSpan.innerHTML != totalDiscontinued ) {
            document.querySelector('#total-discontinued').fadeInContent(totalDiscontinued);
        }
    }
    FLIP(data, resolve, observation = 0){ // observation defaults to 0 for the initial page load animation.  LEGACY FROM WHEN THERE WERE TWO OBSRVATIONS PER YEAR
        this.recordFirstPositions(); // first positions on page
        //this.recordStatuses(data, observation);
        this.clearAttributesAndDetails(); // removes classNames and IDs of nonempty drug

        // params 1. index of the year (2014 -> 0); 2. index of the observation; 
        this.populatePlaceholders(this.model.years.indexOf(data), observation); // last  

        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        tippy(this.nonEmptyDrugs,{
            arrow: true,
            distance: 3
        });
        console.log(this.animateYears !== false);
        var isBackward = S.getState('isBackward');
        if ( this.animateYears !== false && isBackward == false ) {
            this.invertPositions();
        }
            this.playAnimation(resolve, ( this.animateYears && !isBackward ) ); // pass in the `resolve` function from the promise initiated when the year button was pressed or Play loop cycled
           /* if ( !resolve ){
                setTimeout(() => {
                    this.enablePlayButton();
                }, duration);
            }*/
        //} else {
            /*if ( resolve ){
                setTimeout(() => {
                    this.enablePlayButton();
                    resolve(true);
                }, duration);
            } else {
                this.enablePlayButton();
            }*/
          /*  this.playAnimation(resolve);

        }*/

        
     
    }
    recordStatuses(year, observation){
        
        this.previousStatuses = this.model.data[this.model.years.indexOf(+year)].observations[observation].reduce((acc, phase) => { // cur is the phase object
                phase.values.forEach(drug => {
                    acc[drug.id] = {
                        column: drug[year][observation].column,
                        isDiscontinued: drug[year][observation].isDiscontinued
                    };
                })
            return acc;
        },{});
    }
    recordFirstPositions(){
        this.firstPositions = Array.from(document.querySelectorAll('.' + s.drug + ':not(' + s.drugEmpty + ')')).reduce((acc, cur) => {
            
            acc[cur.id] = cur.getBoundingClientRect();
            return acc;
        },{});
    }
    clearAttributesAndDetails(){
        this.nonEmptyDrugs.forEach(drug => {
            drug.className =  `${s.drug} ${s.drugEmpty}`;
            drug.id = '';
            drug.setAttribute('data-tippy-content','');
            if ( drug._tippy ){
                drug.removeAttribute('tabindex');
                drug._tippy.destroy();
            }
           // drug.innerText = '';
        });
    }
    invertPositions(){
        this.nonEmptyDrugs.forEach(drug => {
            drug.style.transitionDuration = '0s';
            var lastPosition = drug.getBoundingClientRect(),
                deltaY = this.firstPositions[drug.id] ? this.firstPositions[drug.id].top - lastPosition.top : -3000,
                deltaX = this.firstPositions[drug.id] ? this.firstPositions[drug.id].left - lastPosition.left : -3000; // drugs that are entering will not have firstPositions
            drug.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            if ( deltaY !== 0 || deltaX !== 0 ){
                 drug.classList.add(s.isTranslated);
            }
            if ( !this.firstPositions[drug.id] ){
                drug.classList.add(s.entering);
            }
        });
    }
    playAnimation(resolve, animateYears){
        console.log(S.getState('isBackward'));
        var column = headers.length,
            currentState = S.getState('year'),
            currentYear = currentState[0],
            currentObservation = currentState[2];
        //console.log(currentYear, currentObservation);
            
        function testColumn(){
            return column > 0 ;
        }
        function incrementColumn(){
            column--;
        }
       
        function resolveTrue(duration){
            if (resolve) {
                
                setTimeout(function() {
                    resolve(true);
                }, duration);
                
            }
        }
        
        function transition(DOMDrug, dur = duration, index = null){
            let _index = index;
           // var translateXY = DOMDrug.style.transform.match(/translate\((.*?)\)/)[1].replace(' ','').split(',');
           // var distanceToTravel = Math.sqrt( Math.abs(parseInt(translateXY[0])) ** 2 + Math.abs(parseInt(translateXY[0])) ** 2 );
            var styleMatch = DOMDrug.style.transform.match(/translate\((.*?)\)/);
            var translateXY = styleMatch ? styleMatch[1].replace(' ','').split(',').map(d => parseInt(d)) : [0,0];
            console.log(translateXY);
            if ( ( translateXY[0] !== 0 || translateXY[1] !== 0 ) && ( index === 0 || index === 1 || index === 3 ) ){
                DOMDrug.classList.add(s.isMoving);
                DOMDrug._tippy.show(0);
            }
            DOMDrug.style.transitionDuration = dur / 1000 + 's';
            setTimeout(() => {
                console.log(DOMDrug._tippy.popper.style);
                var match = DOMDrug._tippy.popper.style.transform.match(/translate3d\((.*?)\)/);
                var popperCurrentTranslate3d = match ? match[1].replace(' ','').split(',').map(d => parseInt(d)) : [0,0,0];
                console.log(popperCurrentTranslate3d);
                if ( _index === 0 || _index === 1 || _index === 3 ){
                    DOMDrug._tippy.popper.style.transitionDuration = dur / 1000 + 's';
                    DOMDrug._tippy.popper.style.transitionTimingFunction = 'ease-in-out';
                }
                window.requestAnimationFrame(function(){
                   if ( _index === 0 || _index === 1 || _index === 3 ){
                    DOMDrug._tippy.popper.style.transform = `translate3d(${parseInt(popperCurrentTranslate3d[0]) - parseInt(translateXY[0])}px, ${parseInt(popperCurrentTranslate3d[1]) - parseInt(translateXY[1])}px, 0px)`;
                   }
                    DOMDrug.style.transform = 'translate(0px,0px)';
                });
                setTimeout(function(){
                    DOMDrug.classList.remove(s.isMoving);
                    DOMDrug.classList.remove(s.isTranslated);
                    DOMDrug._tippy.popper.style.transitionDuration = '0s';
                    DOMDrug._tippy.hide();
                }, dur);
            });
        }
        function highlightColumn(bool){
            if ( column > 0 ){
                let header = document.querySelectorAll('.' + s.headerDiv)[column - 1];
                if (bool){
                    header.classList.add(s.isAnimating);
                } else {
                    header.classList.remove(s.isAnimating);
                }
            }
        }
        function animateSingleColumn(resolve){
            let subsetDelay = animateYears ? 500 : 0;
            highlightColumn(true);
            this.disableYearButtons();

            var matchingDrugIDs = Object.keys(this.previousStatuses).filter(id => this.previousStatuses[id].column === column),
                matchingDOMDrugs = Array.from(this.nonEmptyDrugs).filter(DOMDrug => matchingDrugIDs.includes(DOMDrug.id));
            var elementsWillStayButMove = matchingDOMDrugs.filter(el => {
                var currentDatum = this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation];
                var translateXY = el.style.transform.match(/translate\((.*?)\)/) ? el.style.transform.match(/translate\((.*?)\)/)[1].replace(' ','').split(',') : [0,0];
                el.translateXY = translateXY;
                return ( this.previousStatuses[el.id].column === currentDatum.column && this.previousStatuses[el.id].isDiscontinued === currentDatum.isDiscontinued && ( translateXY[0] !== '0px' || translateXY[1] !== '0px' ) );
            });
            var elementsWillChangeStatus = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].isDiscontinued !== this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation].isDiscontinued );     
            var elementsWillMoveForward = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].column !== 0 && this.previousStatuses[el.id].column < this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation].column );
            var elementsWillMoveBackward = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].column > this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation].column );
            var elementsWillEnter = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].column === 0);

            var subsets = [elementsWillMoveForward, elementsWillMoveBackward, elementsWillStayButMove, elementsWillChangeStatus, elementsWillEnter];
           // console.log(elementsWillStayButMove);
            var lengthOfAllSubsets = subsets.reduce(function(acc,cur){
                return acc + cur.length;
            },0);
            console.log(lengthOfAllSubsets);
            
            function handleSubset(index){
                
                let _index = index;
                console.log('    subset ' + index , subsets[index]);
                new Promise(resolve => {
                    if (subsets[_index].length === 0){
                        console.log('      skipping ^');
                        resolve(true);        // if the subset is empty, resolve right away
                    } else {
                        subsets[_index].forEach((DOMDrug, i, array) => {
                            //var translateXY = DOMDrug.style.transform.match(/translate\((.*?)\)/)[1].replace(' ').split(',');
                            //var dur = translateXY[0] === 0 && translateXY[1] === 0 ? 0 : duration;
                            var dur = _index === 2 ? duration / 12 : _index === 4 ? duration / 1.5 : duration; // speeds up transition for drugs that will stay but move; slows it down for  drugs that will enter
                            var delay = _index === 2 ? dur * .5 * i : _index === 4 ? dur * .1 * i : dur * i;
                            if (!animateYears){
                                dur = 0;
                                delay = 0; 
                            }
                            setTimeout(() => {
                                console.log(dur);
                                transition(DOMDrug, dur, _index); // passing in the existing translate coords so that timing can be base on distance
                            }, delay);
                            if ( i === array.length - 1 ){
                                console.log(_index);
                                let resolveDelay = _index === 4 ? dur * 2 + subsetDelay : _index === 2 ? 0 : dur * (i + 1) + subsetDelay;
                                if ( !animateYears ){
                                    resolveDelay = 0;
                                }
                                setTimeout(() => {
                                    resolve(true);
                                }, resolveDelay); // wait until last item in subset has finished its transition
                                              // before resolving and triggering the next subset
                            }
                        });
                    }
                }).then(() => {
                    index++;
                    if ( index < subsets.length ){ // if there are still more subsets to handle, handle them
                        handleSubset.call(this, index);
                    } else {
                        //return; // if not, stop

                        if ( testColumn() ){
                            //setTimeout(() => {
                                highlightColumn(false);
                                incrementColumn();
                                animateSingleColumn.call(this, resolve);
                        } else {
                            let delayBetweenObservation = animateYears ? 0 : 0
                            setTimeout(() => {
                                this.enableYearButtons();
                                console.log(S.getState('year')[0], this.model.years[this.model.years.length - 1], S.getState('year')[2]);
                                    this.enablePlayButton();
                                    if ( S.getState('year')[0] == this.model.years[this.model.years.length - 1] ) {
                                        highlightColumn(false);
                                        this.showReplayOption();
                                    }
                                if ( !S.getState('isPaused') ){
                                    highlightColumn(false);
                                    resolve(true);  
                                } else {
                                    highlightColumn(false);
                                    this.removePauseOption();
                                    this.enableYearButtons();
                                }
                            }, delayBetweenObservation);
                        }
                    }
                });
            }
            setTimeout(() => {
                handleSubset.call(this,0);
            }, subsetDelay);
          
        } // end animateSingleColumn
        
        // continue playAnimation, which is called once for each observation (2x for each year)
        if ( isFirstLoad ){ // ie is  the first animation on load FIRST ANIMATION

            
            this.nonEmptyDrugs.forEach((DOMDrug) => {
                transition(DOMDrug, 0);
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
            
            new Promise(resolve => {
                animateSingleColumn.call(this, resolve);
            }).then(function(){
                resolveTrue(0);
            });
        }
    }
}