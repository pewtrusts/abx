import Element from '@UI/element';
import s from './styles.scss';
import { stateModule as S } from 'stateful-dead';
import PS from 'pubsub-setter';
import tippy from 'tippy.js';
import './tippy-styles.scss';

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
const duration = 650;

var  isFirstLoad = true;



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
        function addIdsAndClasses(placeholder, drug, containerIndex){
            console.log(drug);
            function appendDetails(){
                //var drawer = document.createElement('div');
                //drawer.classList.add(s.detailDrawer);
                placeholder.setAttribute('data-tippy-content',`<strong>${drug.name}</strong><br />${drug.company}`);
                //placeholder.appendChild(drawer);   
            }
            placeholder.id = drug.id;
           // placeholder.innerText = drug.id.split('-')[1];
            placeholder.classList.remove(s.drugEmpty);
            placeholder.classList.add(`${ drug.gramNegative ? s.gramNegative : 'nope' }`, `${ drug.novel ? s.novel : 'nope' }`, `${ drug.urgent ? s.urgent : 'nope' }`);
            if ( containerIndex === 1 ){
                placeholder.classList.add(s.isDiscontinued);
            }
            appendDetails()
        }
        var activeContainer = document.querySelector('.' + s.activeContainer),
            discontinuedContainer = document.querySelector('.' + s.discontinuedContainer);

        // copy index 1 of phaseMembers to index 0. JSON parse/stringify to make deep copy
        this.phaseMembers[0] = JSON.parse(JSON.stringify(this.phaseMembers[1]));
        console.log(this.phaseMembers);
        [activeContainer, discontinuedContainer].forEach((container, k) => {
            this.model.data[yearIndex].observations[observation].forEach((phase, i) => {
                function getPhaseMembersIndex(id){
                    return this.phaseMembers[1][i + 1][ ( k === 0 ? 'active' : 'discontinued' ) ].indexOf(id)   
                }
                // filter drugs by whether they're active or discontinued; also sort them based on whether they were already in the column
                //  they are about to be placed in
                var filtered = phase.values.filter(d => k === 0 ? !d[this.model.years[yearIndex]][observation].isDiscontinued : d[this.model.years[yearIndex]][observation].isDiscontinued).sort((a, b) => {
                        var existingIndexA = getPhaseMembersIndex.call(this, a.id),
                            existingIndexB = getPhaseMembersIndex.call(this, b.id);
                          //  console.log('a ', a.id, 'b ', b.id);
                        if ( this.phaseMembers[0][0].active.includes(a.id) ) { //  if a was previously in column0 (ie off screen / is entering ), sort last
                            console.log('a is entering', a.id)
                            return this.phaseMembers[0][0].active.includes(b.id) ? a.id - b.id : 1;
                        }
                        if ( this.phaseMembers[0][0].active.includes(b.id) ) {
                            return -1;
                        }
                        if ( existingIndexB < 0 && existingIndexA >= 0 ) { // if drug is entering the column, ie, not already in it
                         //   console.log('a was in column, b was not');
                            return -1;
                        }
                        if (existingIndexA < 0 && existingIndexB >= 0 ) {
                         //   console.log('a was not in column, b was');
                            return 1;
                        }
                        if ( getPhaseMembersIndex.call(this, a.id) < getPhaseMembersIndex.call(this, b.id) ) { 
                         //   console.log('both were in column, a before b');
                            return -1;
                        }
                        if ( getPhaseMembersIndex.call(this, a.id) > getPhaseMembersIndex.call(this, b.id) ) { 
                         //   console.log('both were in column, b before a');
                            return 1;
                        }
                        console.log('returning 0', a.id, b.id);
                        return a.id - b.id;
                    }),
                    column = container.querySelectorAll('.' + s.column)[i];
                
                
                // clear the phaseMember array now that its previous contents have been utilized
                this.phaseMembers[1][i + 1][ ( k === 0 ? 'active' : 'discontinued' ) ].length = 0;
                filtered.forEach((drug, j) => {
                    var placeholder = column.querySelectorAll('.' + s.drug)[j];
                    addIdsAndClasses(placeholder, drug, k);
                    this.phaseMembers[1][i + 1][ ( k === 0 ? 'active' : 'discontinued' ) ].push(drug.id); // place the drug in the proper bucket tracking its column
                });
                this.phaseMembers[1][0].active = this.model.unnestedData.filter(d => d[+this.currentYear][this.currentObservation].column === 0).map(each => each.id);
                console.log(this.phaseMembers);
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
    init() {
        PS.setSubs([
            ['resize', this.checkHeight.bind(this)],
            ['year', this.update.bind(this)]
        ]);
        this.setYearState([this.model.years[0], null, 1]);
        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        this.checkHeight();
        this.initializeYearButtons();
        this.initializePlayButton();
    }
    initializePlayButton(){
        var playButton = document.querySelector('.' + s.playButton);
        playButton.addEventListener('click', this.playYears.bind(this));
    }
    pausePlay(){
        this.playBtn.blur();
        this.playBtn.removeEventListener('click', this.pausePlay.bind(this));
        S.setState('isPaused', true);
        this.playBtn.classList.add(s.willPause);
    }
    playYears(){
        this.playBtn = this.playBtn || document.querySelector('.' + s.playButton);
        this.playBtn.blur();
        S.setState('isPaused', false);
        var currentYear = S.getState('year')[0],
            currentObservation = document.querySelector('.' + s.yearButtonActive).classList.contains(s.observation0) ? 0 : 1;
        this.showPauseOption();
        if ( this.model.years.indexOf(currentYear) === this.model.years.length - 1 && currentObservation === 1 ){
            this.removeReplayOption();
            isFirstLoad = true;
            this.clearAttributesAndDetails();
            this.setYearState([this.model.years[0], null, 0], true);
            setTimeout(() => {
                this.playYears();
            }, duration * 2);
           return;
        }
        function nextPromise(){
            if ( S.getState('isPaused') ){
                this.removePauseOption();
                return;
            }
            currentYear++;
            if ( currentYear <= this.model.years[this.model.years.length - 1] ){
                new Promise(wrapperResolve => {
                    new Promise(resolve => {
                        this.setYearState([currentYear, resolve, 0]); 
                    }).then(() => {
                        this.setYearState([currentYear, wrapperResolve, 1]);
                    });    
                }).then(() => {
                    nextPromise.call(this);
                });
            
            } else {
                this.showReplayOption.call(this);
            }
        }
        if ( currentObservation === 0 ){
            new Promise((resolve) => {
                if ( !S.getState('isPaused') ){
                    resolve(false);
                } else {
                    this.setYearState([currentYear, resolve, 1]); 
                }
            }).then(resolution => {
                if ( !S.getState('isPaused') && resolution === true ){
                    nextPromise.call(this);
                } //else {
                    //this.removePauseOption();
               // }
            });
        } else {
            if ( !S.getState('isPaused') ){
                nextPromise.call(this);
            }
        } 

    }
    showReplayOption(){
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.classList.add(s.replay);
        this.replayBtn.title = "Replay";
    }
    showPauseOption(){
        this.removeReplayOption();
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.removeEventListener('click', this.playYears.bind(this));
        this.replayBtn.addEventListener('click', this.pausePlay.bind(this));
        this.replayBtn.classList.add(s.pause);
        this.replayBtn.title = "Pause";
    }
    removePauseOption(){
        console.log('removing pause option');
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.removeEventListener('click', this.pausePlay.bind(this));
        this.replayBtn.addEventListener('click', this.playYears.bind(this));
        this.replayBtn.classList.remove(s.pause);
        this.replayBtn.classList.remove(s.willPause);
        this.replayBtn.title = "Play";
    }
    removeReplayOption(){
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.classList.remove(s.replay);
        this.replayBtn.title = "Play";
    }
    checkHeight() {

        
        
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
            
            var _this = this;
            button.addEventListener('click', function(){
                S.setState('isPaused', false);
                var currentYear = S.getState('year')[0];
                this.blur();
                if ( currentYear !== this.value ) { // is not the already selected button
                    let observations = this.value > currentYear ? [0,1] : [1,0];
                    
                    new Promise(resolve => {
                        _this.setYearState([this.value, resolve, observations[0]]);
                    }).then(() => {
                        _this.setYearState([this.value, null, observations[1]]);
                    });
                } else {
                    let observation = this.classList.contains(s.observation0) ? 1 : 0;
                    _this.setYearState([this.value, null, observation]);   
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
        //this.recordStatuses(data, observation);
        this.clearAttributesAndDetails(); // removes classNames and IDs of nonempty drug

        // params 1. index of the year (2014 -> 0); 2. index of the observation; 
        this.populatePlaceholders(this.model.years.indexOf(data), observation); // last  

        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        tippy(this.nonEmptyDrugs,{
            arrow: true,
            distance: 3
        });
        
        this.invertPositions();
        this.playAnimation(resolve); // pass in the `resolve` function from the promise initiated when the year button was pressed or Play loop cycled

        
     
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
    playAnimation(resolve){
        
        var column = headers.length,
            currentState = S.getState('year'),
            currentYear = currentState[0],
            currentObservation = currentState[2];
        console.log(currentYear, currentObservation);
            

       
        function resolveTrue(duration){
            if (resolve) {
                
                setTimeout(function() {
                    resolve(true);
                }, duration);
                
            }
        }
        
        function transition(DOMDrug){
           // var translateXY = DOMDrug.style.transform.match(/translate\((.*?)\)/)[1].replace(' ','').split(',');
           // var distanceToTravel = Math.sqrt( Math.abs(parseInt(translateXY[0])) ** 2 + Math.abs(parseInt(translateXY[0])) ** 2 );
           // var factor = distanceToTravel / 1414.21;
            DOMDrug.style.transitionDuration = duration / 1000 + 's';
            DOMDrug.style.transform = 'translate(0px,0px)';
            setTimeout(function(){
                DOMDrug.classList.remove(s.isTranslated);
            }, duration);
        }
        
        function animateSingleColumn(resolve){
            console.log('  column ' + column);
            var matchingDrugIDs = Object.keys(this.previousStatuses).filter(id => this.previousStatuses[id].column === column),
                matchingDOMDrugs = Array.from(this.nonEmptyDrugs).filter(DOMDrug => matchingDrugIDs.includes(DOMDrug.id));
            var elementsWillStayButMove = matchingDOMDrugs.filter(el => {
                var currentDatum = this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation];
                var translateXY = el.style.transform.match(/translate\((.*?)\)/)[1].replace(' ','').split(',');
                el.translateXY = translateXY;
                return ( this.previousStatuses[el.id].column === currentDatum.column && this.previousStatuses[el.id].isDiscontinued === currentDatum.isDiscontinued && ( translateXY[0] !== '0px' || translateXY[1] !== '0px' ) );
            });
            var elementsWillChangeStatus = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].isDiscontinued !== this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation].isDiscontinued );     
            var elementsWillMoveForward = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].column < this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation].column );
            var elementsWillMoveBackward = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].column > this.model.unnestedData.find(d => d.id === el.id)[currentYear][currentObservation].column );
            var elementsWillEnter = matchingDOMDrugs.filter(el => this.previousStatuses[el.id].column === 0);

            var subsets = [elementsWillMoveForward, elementsWillMoveBackward, elementsWillChangeStatus, elementsWillStayButMove, elementsWillEnter];
           // console.log(elementsWillStayButMove);
            var lengthOfAllSubsets = subsets.reduce(function(acc,cur){
                return acc + cur.length;
            },0);
            console.log(lengthOfAllSubsets);
            
            function handleSubset(index){
                console.log('    subset ' + index );
                new Promise(resolve => {
                    if (subsets[index].length === 0){
                        console.log('      skipping ^');
                        resolve(true);        // if the subset is empty, resolve right away
                    } else {
                        subsets[index].forEach((DOMDrug, i, array) => {
                            //var translateXY = DOMDrug.style.transform.match(/translate\((.*?)\)/)[1].replace(' ').split(',');
                            //var dur = translateXY[0] === 0 && translateXY[1] === 0 ? 0 : duration;
                            transition(DOMDrug); // passing in the existing translate coords so that timing can be base on distance
                            if ( i === array.length - 1 ){
                                setTimeout(() => {
                                    resolve(true);
                                }, duration); // wait until last item in subset has finished its transition
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
                        if ( column > 0 ){
                            //setTimeout(() => {
                                column--;
                                animateSingleColumn.call(this, resolve);
                            //}, del);
                        } else {
                            let delayBetweenObservation = lengthOfAllSubsets === 0 ? duration : 0;
                            setTimeout(() => {
                               if ( !S.getState('isPaused') ){
                                    resolve(true);  
                                } else {
                                    this.removePauseOption();
                                }
                            }, delayBetweenObservation);
                        }
                    }
                });
            }
            handleSubset.call(this,0);
          
        } // end animateSingleColumn
        
        // continue playAnimation, which is called once for each observation (2x for each year)
        if ( isFirstLoad ){ // ie is  the first animation on load FIRST ANIMATION

            
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
            
            new Promise(resolve => {
                animateSingleColumn.call(this, resolve);
            }).then(function(){
                resolveTrue(0);
            });
        }
    }
}