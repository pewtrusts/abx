.sort((a, b) => {
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
                    })