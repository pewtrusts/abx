import Element from '@UI/element';


export default class VisuallyHidden extends Element {
    
    prerender(){
         //container
        var view = super.prerender();
        this.name = 'VisuallyHidden';
        if ( this.prerendered && !this.rerender) {
            return view; // if prerendered and no need to render (no data mismatch)
        }
        view.classList.add('visually-hidden');
        this.model.data.forEach(year => {

            var heading = document.createElement('h2');
            view.appendChild(heading);
            heading.textContent = year.year;
            year.observations[0].forEach(phase => {
                var subheading = document.createElement('h3');
                subheading.textContent = phase.phase === 4 ? 'New drug application' : phase.phase === 5 ? 'Approved' : 'Phase ' + phase.phase;
                view.appendChild(subheading);
                ['Active','Inactive'].forEach((status,i) => {
                    var statusLabel = document.createElement('h4');
                    statusLabel.textContent = status;
                    view.appendChild(statusLabel);
                    var list = document.createElement('ul');
                    var matches = phase.values.filter(d => i === 0 ? !d[year.year][0].isDiscontinued : d[year.year][0].isDiscontinued );
                    matches.forEach(drug => {
                        var item = document.createElement('li');
                        item.textContent = `${drug.name} (${drug.company})`;
                        list.appendChild(item);
                    });
                    view.appendChild(list);
                });
            });

        });
        return view;
    }
    init(){
    }
}