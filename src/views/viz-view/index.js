import Element from '@UI/element';
import s from './styles.scss';
//import { stateModule as S } from 'stateful-dead';
import PS from 'pubsub-setter';

const minUnitDimension = 30; // minimum px height/width accepted for touchable element
const headerHeight = 1.5 * minUnitDimension; // the height of the phase-heading bars relative to minUnitDimension
const unitPadding = 2
const headers = [
    ['Phase 1', 'P1'],
    ['Phase 2', 'P2'],
    ['Phase 3', 'P3'],
    ['New Drug Application', 'NDA'],
    ['Approved', '&#10004']
];

export default class VizView extends Element {
    prerender() { // this prerender is called as part of the super constructor
        /* any children need to be instatiated here */

        this.minUnitDimension = minUnitDimension;
        this.headerHeight = headerHeight;
        this.unitPadding = unitPadding;
        this.headers = headers;
        this.heightNeeded = ( this.model.maxActive + this.model.maxDiscontinued ) * ( this.minUnitDimension + this.unitPadding ) + this.headerHeight + this.unitPadding;

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
        var activeContainer = document.querySelector('.' + s.activeContainer),
            discontinuedContainer = document.querySelector('.' + s.discontinuedContainer);
        this.model.data[year].values.forEach((phase, i) => {
            var active = phase.values.filter(d => !d.isDiscontinued),
                discontinued = phase.values.filter(d => d.isDiscontinued),
                activeColumn = activeContainer.querySelectorAll('.' + s.column)[i],
                discontinuedColumn = discontinuedContainer.querySelectorAll('.' + s.column)[i];
            active.forEach((drug, j) => {
                activeColumn.querySelectorAll('.' + s.drug)[j].classList.remove(s.drugEmpty);
            });
            discontinued.forEach((drug, j) => {
                discontinuedColumn.querySelectorAll('.' + s.drug)[j].classList.remove(s.drugEmpty);
            });
        });
    }
    init() {
        this.populatePlaceholders(0);
        this.checkHeight();
        PS.setSubs([
            ['resize', this.checkHeight.bind(this)]
        ]);
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
    update( /*msg,data*/ ) {

    }
}