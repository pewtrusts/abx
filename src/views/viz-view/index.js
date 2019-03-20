import Element from '@UI/element';
//import s from './styles.scss';
//import { stateModule as S } from 'stateful-dead';
//import PS from 'pubsub-setter';

export default class VizView extends Element {
    prerender(){ // this prerender is called as part of the super constructor
        /* any children need to be instatiated here */

        //container
        var view = super.prerender();
        if ( this.prerendered && !this.rerender) {
            return view; // if prerendered and no need to render (no data mismatch)
        }
        
        /* prerender non prerendered here */
        var placeholder = document.createElement('div');
        placeholder.textContent = 'placeholder';
        view.appendChild(placeholder);
        return view;
    }
    init(){
       // PS.setSubs([

       // ]);
    }
    update(/*msg,data*/){
      
    }
}