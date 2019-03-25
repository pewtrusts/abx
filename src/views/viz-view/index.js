import Element from '@UI/element';
import s from './styles.scss';
import { stateModule as S } from 'stateful-dead';
import PS from 'pubsub-setter';
console.log(s);
const minUnitDimension = 30; // minimum px height/width accepted for touchable element
const headerHeight = 1.5 * minUnitDimension; // the height of the phase-heading bars relative to minUnitDimension
const unitPadding = 2
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
                                                                                // plus one to acct fo discontinued header
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
                yearButton.disabled = ( i === 0 );
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
    populatePlaceholders(year) {
        function addIdsAndClasses(placeholder, drug){
            function appendDetails(){
                var drawer = document.createElement('div');
                drawer.classList.add(s.detailDrawer);
                drawer.innerHTML = `<strong>${drug.name}</strong><br />
                                    ${drug.company}`;
                placeholder.appendChild(drawer);   
            }
            placeholder.insertAdjacentHTML('afterbegin', drug.id);
            placeholder.id = drug.id;
            placeholder.classList.remove(s.drugEmpty);
            placeholder.classList.add(`${ drug.gramNegative ? s.gramNegative : 'nope' }`, `${ drug.novel ? s.novel : 'nope' }`, `${ drug.urgent ? s.urgent : 'nope' }`);
            appendDetails()
        }
        var activeContainer = document.querySelector('.' + s.activeContainer),
            discontinuedContainer = document.querySelector('.' + s.discontinuedContainer);
        [activeContainer, discontinuedContainer].forEach((container, k) => {
            this.model.data[year].values.forEach((phase, i) => {
                var filtered = phase.values.filter(d => k === 0 ? !d.isDiscontinued : d.isDiscontinued),
                    column = container.querySelectorAll('.' + s.column)[i];
                filtered.forEach((drug, j) => {
                    var placeholder = column.querySelectorAll('.' + s.drug)[j];
                    addIdsAndClasses(placeholder, drug);
                });
            });
        });
    }
    init() {
        PS.setSubs([
            ['resize', this.checkHeight.bind(this)],
            ['year', this.update.bind(this)]
        ]);
        this.populatePlaceholders(0);
        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        this.checkHeight();
        this.initializeYearButtons();
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
                var toBeDeselected = document.querySelector('.' + s.yearButtonActive);
                toBeDeselected.disabled = false;
                toBeDeselected.classList.remove(s.yearButtonActive);
                this.disabled = true;
                this.classList.add(s.yearButtonActive);
                S.setState('year', this.value);
            });
        });
    }
    update(msg,data) {
        console.log(msg,data);
        this.FLIP(parseInt(data));
    }
    FLIP(data){
        this.recordFirstPositions(); // first
        this.populatePlaceholders(this.model.years.indexOf(data)); // last
        this.nonEmptyDrugs = document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')');
        console.log(this.firstPositions);
        //setTimeout(() => {
            this.invertPositions();
        //    }, 3000); // invert and play
        // ***** TO DO ****** INVERSION isn't working properly. need to remove classes *and* remove details drawers before repopulating
        // the placeholders. why is there a transition on the invert? are the id's being assign properly?
    }
    recordFirstPositions(){
        console.log(document.querySelectorAll('.' + s.drug + ':not(.' + s.drugEmpty + ')'));
        this.firstPositions = Array.from(document.querySelectorAll('.' + s.drug + ':not(' + s.drugEmpty + ')')).reduce((acc, cur) => {
            
            acc[cur.id] = cur.getBoundingClientRect();
            return acc;
        },{});
        this.nonEmptyDrugs.forEach(drug => {
            var details = drug.querySelector('.' + s.detailDrawer);
            drug.className =  `${s.drug} ${s.drugEmpty}`;
            drug.id = '';
            drug.removeChild(details);
            drug.textContent = '';
        });
        
    }
    invertPositions(){
        this.nonEmptyDrugs.forEach(drug => {
            drug.style.transitionDuration = '0s';
            var lastPosition = drug.getBoundingClientRect(),
                deltaY = this.firstPositions[drug.id] ? this.firstPositions[drug.id].top - lastPosition.top : -1000,
                deltaX = this.firstPositions[drug.id] ? this.firstPositions[drug.id].left - lastPosition.left : -1000; // drugs that are entering will not have firstPositions
            drug.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            setTimeout(function(){ // transition won't happen w/o the settimeout trick
                drug.style.transitionDuration = '0.8s';
                drug.style.transform = 'translate(0,0)';
            });
        });
    }
}