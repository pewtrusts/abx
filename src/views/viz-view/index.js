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

const duration = 200;
const shortDuration = 50;

export default class VizView extends Element {
    prerender() { // this prerender is called as part of the super constructor
        /* any children need to be instatiated here */

        this.minUnitDimension = minUnitDimension;
        this.headerHeight = headerHeight;
        this.unitPadding = unitPadding;
        this.headers = headers;

        this.heightNeeded = (this.model.maxActive + this.model.maxDiscontinued + 1) * (this.minUnitDimension + this.unitPadding) + this.headerHeight + this.unitPadding + 200;
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
            active: headers.map(() => []),
            discontinued: headers.map(() => [])
        };
        this.checkHeight();
        this.initializeYearButtons();
        this.initializeAnimateOnOff();
        this.initializePlayButton();
        this.approvedSpan = document.querySelector('#total-approved');
        this.discontinuedSpan = document.querySelector('#total-discontinued');
        this.totals = document.querySelector('#abx-totals');
        this.container = document.querySelector('.' + s.container);
        S.setState('year', { year: this.model.years[0], source: 'load' });
    }
    update(msg, data) { // here data is an array. [0]: year; [1]: null or `resolve` from the Promise. needs to resolve true when all transitions of current update are finished . 3. observation index
        S.setState('isPaused', false);
        // find btn to be deselected and change its appearance
        var toBeDeselectedActive = document.querySelector('.' + s.yearButtonActive); //observationToCheckAgainst = !S.getState('isBackward') ? 0 : 1;
        toBeDeselectedActive.classList.remove(s.yearButtonActive, s.observation, s.observation0, s.observation1)

        // find button that matches new selection and change its appearance
        var btn = document.querySelector('button[value="' + data.year + '"]');

        //toggle observation 0 or observation 1
        btn.classList.add(s.yearButtonActive);

        if (data.source === 'load') {
            this.populateInitialDrugs(data.year);
        }
        if (data.source === 'yearButton') {
            this.switchYears(data);
        }
        if ( ['play','replay'].includes(data.source) ){
            this.switchYears(data).then(() => {
                setTimeout(() => {
                    this.playYears();
                },500);
            });
        }
    }
    addIdsAndClasses(drugs, year) {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                drugs.forEach((drug, i, array) => {
                    drug.domDrug.id = 'drug-' + drug.id;
                    drug.domDrug.classList.remove(s.drugEmpty);
                    drug.domDrug.classList.add(`${ drug.gramNegative ? s.gramNegative : 'nope' }`, `${ drug.novel ? s.novel : 'nope' }`, `${ drug.urgent ? s.urgent : 'nope' }`); //, `${ previousStatuses && previousStatuses[drug.id] && previousStatuses[drug.id].isDiscontinued && !drug[model.years[yearIndex]].isDiscontinued ? s.wasDiscontinued : 'nope'}`);
                    if (isNaN(drug[year])) {
                        drug.domDrug.classList.add(s.isDiscontinued);
                    }
                    drug.domDrug.setAttribute('data-tippy-content', `<strong>${drug.name}</strong><br />${drug.company}`);
                    drug.domDrug.innerHTML = `<span style="position:absolute;">${drug.id}</span>`;
                    this.setTippys(drug.domDrug);
                    if ( i == array.length - 1 ){
                        setTimeout(() => {
                            resolve(true);
                        });
                    }
                });
            });
        });
    }
    populateInitialDrugs(year) {
        ['active', 'discontinued'].forEach((type, i) => {
            var typeMatches = i === 0 ? this.model.unnestedData.filter(d => !isNaN(d[year])) : this.model.unnestedData.filter(d => isNaN(d[year]));
            headers.forEach((phase, j) => {
                var phaseMatches = typeMatches.filter(d => parseInt(d[year]) === j + 1);
                phaseMatches.forEach((drug, k) => {
                    drug.domDrug = this.columns[type][j].children[k];
                    this.mapPositions({ type, phaseIndex: j, slot: k, drug });
                });
                this.addIdsAndClasses(phaseMatches, year);
            });
            console.log(this.positionMap);
        });
      //  this.setTippys();
        this.updateText(year);
    }
    setTippys(drug = '[data-tippy-content]') {
        tippy(drug, {
            arrow: true,
            distance: 3
        });
    }
    mapPositions({ type, phaseIndex, slot, drug }) {
        this.positionMap[type][phaseIndex][slot] = drug;
    }
    recordScreenPosition(drug) {
        if (!this.isBackward && this.animateYears) {
            drug.previousScreenPosition = drug.domDrug.getBoundingClientRect();
        }
    }
    recordMapPosition({type, phaseIndex, slot, drug}){
        drug.previousMapPosition = `${type}-${phaseIndex}-${slot}`;
    }
    switchYears({ year, source }) {
        return new Promise(resolveYear => {
            var phaseIndex = headers.length - 1;
            var previousYear = S.getPreviousState('year').year;
            this.isBackward = (+previousYear > year);
            this.disableYearButtons();
            if ( !['play','replay'].includes(source) ){
                this.disablePlayButton();
            }

            function iteratePhase() {
                //set up a promise for each phase. this way we can pass the resolve function around and resolve it later,
                // after animation has finish orsooner if there is no animation
                new Promise(resolvePhase => {
                    // TO DO : need to animate each type separately, resolve a promise when done
                    function iterateType(type) {
                        new Promise(resolveType => {
                            var drugsThatMove = [];
                            var drugsThatStay = [];
                            var length = this.positionMap[type][phaseIndex].length;
                            for (let i = length - 1; i >= 0; i--) {
                                let drug = this.positionMap[type][phaseIndex][i];
                                // if the drug being handled now was just moved from another column during the same round
                                // we don't want to do anything to it again. set _previousYear to year so that it's treated as
                                // a drug that stays
                                drug.previousSlot = i;
                                let _previousYear = drug.movedFromProcessedColumn ? year : previousYear;
                                console.log(drug[_previousYear], drug[year]);
                                if (drug[year] != drug[_previousYear] && drug[year] != 0) {
                                    // if drug moves columns, record its position on screen
                                    this.recordScreenPosition(drug);
                                    this.recordMapPosition({type, phaseIndex, slot: i, drug});
                                    let newType = isNaN(drug[year]) ? 'discontinued' : 'active';
                                    let newPhaseIndex = parseInt(drug[year]) - 1;
                                    // add some attributes to the drug
                                    // put the drug in its new position in the positionMap, ie, the first empty slot of the relevant "column"
                                    this.mapPositions({ type: newType, phaseIndex: newPhaseIndex, slot: this.positionMap[newType][newPhaseIndex].length, drug });
                                    // remove the drug from the original position. should be ok bc we are looping in reverse. shouldn't leave gaps
                                    let splice = this.positionMap[type][phaseIndex].splice(i, 1);
                                    console.log(this.positionMap[type][phaseIndex], i, splice);
                                    drug.movedFromProcessedColumn = true;
                                    drug.moved = true;

                                    // need to mark drugs that move from one type to another but within same phase. ie phase 2 to 2d (discontinued)
                                    // bc we need to exclude that drug from being processed again in the same phase loop
                                    drug.movedFromSamePhase = parseInt(drug[year]) === parseInt(drug[_previousYear]);

                                    drugsThatMove.push(drug);
                                } else if (drug[year] != 0) {
                                    // may not need to record its position on screen. expensive computation
                                    drugsThatStay.push(drug);
                                    this.recordMapPosition({type, phaseIndex, slot: i, drug});
                                } else { // phase value for the drug this year is zero. ie, moving backward in years
                                    // TO DO : also put in another place "exiting"
                                    this.recordMapPosition({type, phaseIndex, slot: i, drug});
                                    this.positionMap[type][phaseIndex].splice(i, 1);
                                    //this.clearAddedDrugAttributes(drug);
                                }

                                drug.phaseIndex = parseInt(drug[year]) - 1;
                                drug.type = isNaN(drug[year]) ? 'discontinued' : 'active';
                            }
                            // drugs that stay (in a column) may still moved, ie, change slots.
                            // compare their previous slot with their new one
                            drugsThatStay.reverse().forEach((drug, i) => {
                                if (drug.previousSlot != i) {
                                    drug.moved = true;
                                    drug.keptSameStatus = true;
                                    this.recordScreenPosition(drug);
                                } else {
                                    drug.moved = false;
                                }
                            });
                            drugsThatStay.reverse();
                            this.clearPhase(phaseIndex, type).then(() => {
                                this.placeDrugs([...drugsThatMove, ...drugsThatStay.reverse()], resolveType, year);
                            });
                        }).then(() => {
                            if (type == 'active') {
                                type = 'discontinued';
                                iterateTypeBind(type);
                            } else {
                                resolvePhase(true);
                            }
                        }); // end Promise resolveType
                    } // end fn iterateType
                    var iterateTypeBind = iterateType.bind(this);
                    iterateTypeBind('active');
                }).then(() => {
                    if (phaseIndex > 0) {
                        phaseIndex--;
                        iteratePhaseBind();
                    } else {
                        //gone through the phases and need to place entering drugs
                        let enteringDrugs = this.model.unnestedData.filter(d => d[previousYear] == 0 && d[year] != 0);
                        console.log('foo', enteringDrugs);
                        new Promise(resolveEntering => {
                            this.enterDrugs(enteringDrugs, year, resolveEntering)
                        }).then(() => {
                            //this.setTippys();
                            this.updateText(year);
                            this.removeTemporaryPlaceholders();
                            this.clearAddedDrugAttributes();
                            setTimeout(() => {
                                resolveYear(true);
                            }, year == this.model.years[0] && source == 'replay' ? 500 : 0);
                        });
                    }
                }); // end Promise resolvePhase

            } // end iteratePhase
            var iteratePhaseBind = iteratePhase.bind(this);
            //setTimeout(() => {
                iteratePhaseBind();
           // }, source == 'replay' ? 2000 : 0);
        }).then(() => {
            this.enableYearButtons();
            this.enablePlayButton();
        });
    }
    clearAddedDrugAttributes() {
        this.model.unnestedData.forEach(drug => {
            delete drug.previousSlot;
            delete drug.slot;
            delete drug.phaseIndex;
            delete drug.moved;
            delete drug.previousScreenPosition;
            delete drug.movedFromProcessedColumn;
            delete drug.movedFromSamePhase;
            delete drug.previousMapPosition;
            delete drug.deltaX;
            delete drug.deltaY;
            delete drug.isEntering;
            delete drug.keptSameStatus;
        });
    }
    removeTemporaryPlaceholders() {
        document.querySelectorAll('[data-temporary]').forEach(el => {
            el.parentElement.removeChild(el);
        });
    }
    sortBySlot(a, b) {
        return a.slot - b.slot;
    }
    sortByPhase(a, b) {
        return a.phaseIndex - b.phaseIndex;
    }
    enterDrugs(enteringDrugs, year, resolveEntering) {
        enteringDrugs.forEach(drug => {
            var type = isNaN(drug[year]) ? 'discontinued' : 'active';
            var phaseIndex = parseInt(drug[year]) - 1;
            var slot = this.positionMap[type][phaseIndex].length;
            drug.phaseIndex = phaseIndex;
            drug.type = type;
            drug.previousScreenPosition = { top: -3000, left: -3000 };
            drug.moved = true;
            drug.slot = slot;
            drug.isEntering = true;
            this.mapPositions({ type, phaseIndex, slot, drug });
        });
        this.placeDrugs(enteringDrugs.sort(this.sortBySlot).sort(this.sortByPhase), resolveEntering, year);
    }
    placeDrugs(drugs, resolvePlaceDrugs, year) {
        if ( drugs.length == 0 ){
            resolvePlaceDrugs(true);
            return;
        }
        for ( let i = 0; i < drugs.length; i++ ){
            let slot = this.positionMap[drugs[i].type][drugs[i].phaseIndex].indexOf(drugs[i]);
            let placeholder = this.columns[drugs[i].type][drugs[i].phaseIndex].children[slot];
            if (!placeholder) { // new method of moving drugs one column at a time may result in interim state of
                // a column having to many drugs, ie more than the number of placeholders calculated when the 
                // app first start. here, if placeholder is undefined, create and insert it.
                let _placeholder = document.createElement('div');
                _placeholder.classList.add(s.drug, s.drugEmpty);
                _placeholder.setAttribute('tabindex', 0);
                _placeholder.setAttribute('data-temporary', true);
                this.columns[drugs[i].type][drugs[i].phaseIndex].appendChild(_placeholder);
                placeholder = _placeholder;
            }
            drugs[i].domDrug = placeholder;
        }
        if ( this.animateYears && !this.isBackward ){
            this.invertDrugs(drugs).then(() => {
                this.addIdsAndClasses(drugs, year).then(() => {
                    this.animateDrugs(drugs, resolvePlaceDrugs);
                });
            });
        } else {
            this.addIdsAndClasses(drugs, year).then(() => {
                resolvePlaceDrugs(true);
            });
        }
    }
    invertDrugs(drugs) {
        return new Promise(resolveInvert => {
            var filtered = drugs.filter(d => d.moved);
            if ( filtered.length == 0 ){
                resolveInvert(true);
            }
            for ( let i = 0; i < filtered.length; i++ ){
                filtered[i].domDrug.classList.add(s.isTranslated);
                filtered[i].domDrug.style.transitionDuration = '0s';
                let currentScreenPosition = filtered[i].domDrug.getBoundingClientRect();
                filtered[i].deltaY = filtered[i].previousScreenPosition.top - currentScreenPosition.top;
                filtered[i].deltaX = filtered[i].previousScreenPosition.left - currentScreenPosition.left;
            }
            for ( let i = 0; i < filtered.length; i++ ){
                requestAnimationFrame(() => {
                    filtered[i].domDrug.style.transform = `translate(${filtered[i].deltaX}px, ${filtered[i].deltaY}px)`;
                    /* need to toggle display of the drugs from none back to block to force browsers to repaint them. otherwise 
                    the invertion doens't appear correctly and drugs will appear to start their animations from the wrong spot */
                    filtered[i].domDrug.style.display = 'none';
                    requestAnimationFrame(() => {
                        filtered[i].domDrug.style.display = 'block';
                        if ( i == filtered.length - 1 ){
                            resolveInvert(true);
                        }
                    });
                });
            }
        });
    }
    animateDrugs(drugs, resolvePlaceDrugs) {
            var movedDrugs = drugs.filter(d => d.moved);
            var totalDelay = 0;
            if (movedDrugs.length > 0) {
                movedDrugs.forEach((drug, i, array) => {
                    var _duration = drug.keptSameStatus ? shortDuration : duration; 
                    drug.domDrug.style.transitionDuration = _duration + 'ms';
                    setTimeout(() => {
                        requestAnimationFrame(() => {
                            var popperXYZ;
                            if ( !drug.keptSameStatus && !drug.isEntering ){
                                drug.domDrug._tippy.show();
                                drug.domDrug.classList.add(s.isMoving);
                                setTimeout(() => {
                                    popperXYZ = drug.domDrug._tippy.popper.style
                                        .transform.match(/translate3d\((.*?)\)/)[1]
                                        .split(',').map(xy => parseInt(xy));
                                    drug.domDrug._tippy.popper.style.transitionDuration = _duration + 'ms';
                                    drug.domDrug._tippy.popper.style.transitionTimingFunction = 'ease-in-out';
                                    drug.domDrug._tippy.popper.style.transform = `translate3d(${popperXYZ[0] - drug.deltaX}px, ${popperXYZ[1] - drug.deltaY}px, ${popperXYZ[2]}px)`;
                                    drug.domDrug.style.transform = 'translate(0, 0)';
                                });
                            } else {
                                drug.domDrug.style.transform = 'translate(0, 0)';
                            }
                            setTimeout(() => {
                                drug.domDrug._tippy.hide();
                                drug.domDrug.classList.remove(s.isTranslated);
                                drug.domDrug.classList.remove(s.isMoving);
                                if (i == array.length - 1) {
                                    resolvePlaceDrugs(true);
                                }
                            }, _duration);
                        });
                    },totalDelay);
                    totalDelay += _duration;
                });
            } else {
                resolvePlaceDrugs(true);
            }
    }
    clearPhase(phaseIndex, type) {
        return new Promise(resolveClear => {
            this.columns[type][phaseIndex].childNodes.forEach((drugNode, i, array) => {
                drugNode.className = `${s.drug} ${s.drugEmpty}`;
                drugNode.id = '';
                drugNode.removeAttribute('data-tippy-content');
                drugNode.innerHTML = '';
                if (drugNode._tippy) {
                    drugNode.removeAttribute('tabindex');
                    drugNode._tippy.destroy();
                }
                if ( i == array.length - 1 ){
                    resolveClear(true);
                }
            });
        });
    }
    initializeYearButtons() {
        document.querySelectorAll('.' + s.yearButton).forEach(button => {

            var _this = this;
            button.addEventListener('click', function() {
                var currentYear = S.getState('year')[0];
                if (currentYear != this.value) { // is not the already selected button
                    GTMPush('ABXAnimation|Year|' + this.value);
                    S.setState('isPaused', false);
                    this.blur();
                    _this.disablePlayButton();
                    _this.removeReplayOption();
                    if (+this.value > +currentYear) {
                        S.setState('isBackward', false);
                        new Promise(() => {
                            S.setState('year', { year: this.value, resolve: null, source: 'yearButton' });
                        });
                    } else {
                        S.setState('isBackward', true);
                        new Promise(() => {
                            S.setState('year', { year: this.value, resolve: null, source: 'yearButton' });
                        })
                    }
                }
            });
        });
    }
    initializeAnimateOnOff() {
        this.animateYears = true;

        function handler(el) {
            if (el.checked) {
                GTMPush('ABXAnimation|ToggleAnimation|On');
                this.animateYears = true;
                //this.enablePlayButton();
            } else {
                GTMPush('ABXAnimation|ToggleAnimation|Off');
                this.animateYears = false;
               // this.disablePlayButton();
            }
            console.log(this);
        }
        var input = document.querySelector('.js-animate-checkbox');
        var handlerBind = handler.bind(this);
        input.addEventListener('change', function() {
            handlerBind(this);
        });
    }
    initializePlayButton() {
        this.playYearsBind = this.playYears.bind(this);
        var playButton = document.querySelector('.' + s.playButton);
        playButton.addEventListener('click', this.playYearsBind);
        this.playBtn = playButton;
    }
    pausePlay() {
        
        this.playBtn.blur();
        this.playBtn.removeEventListener('click', this.pausePlayBind);
        S.setState('isPaused', true);
        this.playBtn.classList.add(s.willPause);
    }
    disableYearButtons() {
        this.yearButtons = this.yearButtons || document.querySelectorAll('.' + s.yearButton);
        this.yearButtons.forEach(function(btn) {
            btn.setAttribute('disabled', 'disabled');
        });
    }
    disablePlayButton() {
        this.playBtn = this.playBtn || document.querySelector('.' + s.playButton);
        this.playBtn.setAttribute('disabled', 'disabled');
    }
    enablePlayButton() {
        this.playBtn = this.playBtn || document.querySelector('.' + s.playButton);
        this.playBtn.removeAttribute('disabled');
    }
    enableYearButtons() {
        this.yearButtons = this.yearButtons || document.querySelectorAll('.' + s.yearButton);
        this.yearButtons.forEach(function(btn) {
            btn.removeAttribute('disabled');
        });
    }
    playYears(event, type) {

        if (event == 'replay') {
            GTMPush('ABXAnimation|Replay');
        } else {
            GTMPush('ABXAnimation|Play');
        }
        new Promise(resolvePlayYears => {
            this.showPauseOption();
            var currentYear = type == 'replay' ? this.model.years[0] - 1 : S.getState('year').year;
            if ( +currentYear < this.model.years[this.model.years.length - 1] && !S.getState('isPaused') ){
                S.setState('year', {year: +currentYear + 1, source: type || 'play'});
            } else {
                this.removePauseOption();
                S.setState('isPaused', false);
                resolvePlayYears(true);
                if ( currentYear == this.model.years[this.model.years.length - 1] ){
                    this.showReplayOption();
                }
            }
        });


/*
        let thisResolveDelay = this.animateYears ? 0 : 0.625 * duration;
        S.setState('isPaused', false);
        S.setState('isBackward', false);
        // S.setState('isSameYear', false);
        this.disableYearButtons();
        this.playBtn = this.playBtn || document.querySelector('.' + s.playButton);
        this.playBtn.blur();

        function nextPromise() {
            if (S.getState('isPaused')) {
                this.enableYearButtons();
                this.removePauseOption();
                return;
            }
            currentYear++;
            if (currentYear <= this.model.years[this.model.years.length - 1]) {
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

        if (event !== 'reciprocal') {
            this.showPauseOption();
        }

        var currentYear = S.getState('year')[0];
        if (this.model.years.indexOf(+currentYear) === this.model.years.length - 1) {
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
                if (S.getState('isPaused')) {
                    this.enableYearButtons();
                    resolve(false);
                } else {
                    //setTimeout(() => {
                    resolve(true);
                    //}, thisResolveDelay);
                }
            }).then(resolution => {
                if (!S.getState('isPaused') && resolution === true) {
                    nextPromise.call(this);
                }
            });
        }*/
    }
    showReplayOption() {
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.removeEventListener('click', this.pausePlayBind);
        this.replayBtn.addEventListener('click', e => {
            this.playYearsBind(e, 'replay');
        });
        this.replayBtn.classList.add(s.replay);
        this.replayBtn.classList.remove(s.pause);
        this.replayBtn.classList.remove(s.willPause);
        this.replayBtn.title = "Replay";
    }
    showPauseOption() {
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.pausePlayBind = this.pausePlay.bind(this);
        this.removeReplayOption();
        this.replayBtn.removeEventListener('click', this.playYearsBind);
        this.replayBtn.addEventListener('click', this.pausePlayBind);
        this.replayBtn.classList.add(s.pause);
        this.replayBtn.classList.remove(s.replay);
        this.replayBtn.title = "Pause";
    }
    removePauseOption() {
        console.log('removing pause option');
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.removeEventListener('click', this.pausePlayBind);
        this.replayBtn.addEventListener('click', this.playYearsBind);
        this.replayBtn.classList.remove(s.pause);
        this.replayBtn.classList.remove(s.willPause);
        this.replayBtn.title = "Play";
    }
    removeReplayOption() {
        this.replayBtn = this.replayBtn || document.querySelector('.' + s.playButton);
        this.replayBtn.classList.remove(s.replay);
        //this.replayBtn.title = "Play";
    }
    checkHeight() {

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

        }
        adjustCSSVariables.call(this);
    }
    updateText(year) {
        var totalNonzero = this.model.unnestedData.filter(d => parseInt(d[year]) !== 0),
            totalActive = totalNonzero.filter(d => d[year] == 5).length,
            totalDiscontinued = totalNonzero.filter(d => isNaN(d[year])).length;

        if (+year > this.model.years[0]) {
            this.totals.classList.add('is-subsequent');
        } else {
            this.totals.classList.remove('is-subsequent');
        }
        if (this.approvedSpan.innerHTML != totalActive) {
            document.querySelector('#total-approved').fadeInContent(totalActive);
        }
        if (this.discontinuedSpan.innerHTML != totalDiscontinued) {
            document.querySelector('#total-discontinued').fadeInContent(totalDiscontinued);
        }
    }
    highlightColumn() {
       /* if (column > 0) {
            let header = document.querySelectorAll('.' + s.headerDiv)[column - 1];
            if (bool) {
                header.classList.add(s.isAnimating);
            } else {
                header.classList.remove(s.isAnimating);
            }
        }*/
    }
}