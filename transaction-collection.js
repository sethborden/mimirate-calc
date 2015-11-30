'use strict';

/**
 * @namespace
 */

/**
 * @desc Creates a new Bounds object
 * @class Bounds
 * @classdesc a boundary object with a startDate and endDate
 * @param {Date} startDate - the inclusive start date for the bounds
 * @param {Date} endDate - the inclusive end date for the bounds
 */
var Bounds = function(startDate, endDate) { //jshint ignore:line
    /**
     * Inclusive start date of the bounds
     *
     * @name Bounds#startDate
     * @type Date
     */
    this.startDate = startDate;

    /**
     * Inclusive end date of the bounds
     *
     * @name Bounds#endDate
     * @type Date
     */
    this.endDate = endDate;
};


/**
 * @desc Creates a new Transaction object
 * @class Transaction
 * @classdesc A Transaction object
 * @param {Object} [blob] - Blob that may or may not contain all the information for the transactions.
 * @param {number} blob.growth - Growth rate for the transaction's amount over time, sets {@link Transaction#growth}
 * @param {string} blob.description - Description of the transaction, sets {@link Transaction#description}
 * @param {number} blob.amount - value of the current transaction, or the sum of the values of all child transactions, sets {@link Transaction#amoun}
 * @param {Date} blob.startDate - Date that the transaction first occurs on, sets {@link Transaction#startDate}
 * @param {Date} blob.endDate - Date after which the transaction no longer repeats, sets {@link Transaction#endDate}
 * @param {string} blob.frequency - How often the transaction repeats itself: daily, weekly, bi-weekly, or monthly, sets {@link Transaction#frequency}
 * @param {string} blob.type - Used to flag special types of transactions like loans, etc.
 */
var Transaction = function(blob) {
    //Since the blob is optional, create an empty blob is one isn't provided
    if (!blob) {
        blob = {};
    }

    /**
     * Depth counter for our objects, quite useful really
     * Transactions created in isolation are given a depth of -1, as we assume
     * that top level transaction are blob containers; subsequent transactions
     * that may be added to the blob via the {@link Transaction#addChild} or
     * {@link Transaction#addChildren} methods have their depth automatically
     * incremented.
     * @name Transaction#depth
     * @type number
     */
    this.depth = -1; //Assume that top level transactions are essentially blob containers

    /**
     * Growth rate for the transaction's amount over time
     *
     * @name Transaction#growth
     * @type number
     */
    this.growth = blob.growth ? blob.growth : null;

    /**
     * Growth rate for the transaction's amount over time
     *
     * @name Transaction#description
     * @type string
     */
    this.description = blob.description ? blob.description : null;

    /**
     * Value of the transaction on {@link Transaction#startDate}
     *
     * @name Transaction#amount
     * @type number
     */
    this.amount = blob.amount ? Number(blob.amount) : null;

    /**
     * Date and time of the first occurence of the transaction
     *
     * @name Transaction#startDate
     * @type Date
     */
    this.startDate = blob.startDate ? new Date(blob.startDate) : null;

    /**
     * Date and time after which the transaction will no longer occur
     *
     * @name Transaction#endDate
     * @type Date
     */
    this.endDate = blob.endDate ? new Date(blob.endDate) : null;

    /**
     * Frequency with with the transaction re-occurs
     *
     * @name Transaction#frequency
     * @type string
     */
    this.frequency = blob.frequency ? blob.frequency : 'none'; 

    /**
     * Frequency with with the transaction re-occurs
     *
     * @name Transaction#frequency
     * @type string
     */
    this.transactionType = blob.transactionType ? blob.transactionType : 'plain'; 

    /**
     * The UUID4 for the transaction and all others in its time-series
     *
     * @name Transaction#series
     * @type string
     */
    this.series = blob.series ? blob.series : this.generateUUID();

    /**
     * Child transactions of this transaction
     *
     * @name Transaction#children
     * @type Transaction[]
     */
    this.children = [];

    /**
     * Parent Transaction of this transaction
     *
     * @name Transaction#parentTransaction
     * @type Transaction
     */
    this.parentTransaction = null;

    /**
     * Scenarios for this transaction that allow us to create fun new 'what-ifs'
     * @name Transaction#scenarios
     * @type Scenario[]
     */
    this.scenarios = [];

    /**
     * Accumulator for this transaction that is used to gather children
     *
     * @name Transaction#accumulator
     * @type Transaction[]
     */
    this.accumulator = []; 
};

/**
 * @desc Returns a really simple description of the transaction
 * @returns {Object} Serialized object of the transaction.
 */
Transaction.prototype.serialize = function() {
    return {
        growth: this.growth,
        description: this.description,
        amount: this.amount,
        startDate: this.startDate,
        endDate: this.endDate,
        frequency: this.frequency,
        series: this.series,
        transactionType: this.transactionType
    };
};

/**
 * @desc Adds a child transaction to the transaction
 * @param {Object} blob - a blob object to be added as a child.
 * @returns {Transaction} Transaction that was just created and added as a child
 */
Transaction.prototype.addChild = function(blob) {
    var newChild;
    if(blob.constructor !== 'Transaction') {
        newChild = new Transaction(blob);
    } else {
        newChild = blob;
    }
    newChild.parentTransaction = this;
    newChild.depth = this.depth + 1;
    this.children.push(newChild);
    this.setAmount();
    return newChild;
};

/**
 * @desc Add an array of transaction-like objects as child transactions
 * @param {Object[]} blobs - Array of blobs to be added as children
 */
Transaction.prototype.addChildren = function(blobs) {
    var self = this;

    //Recurse through each of the blobx
    blobs.forEach(function(blob) {
        var newChild;
        //If the blob doesn't have a 'children array' we add an empty one
        if (!blob.children) {
            blob.children = [];
        }

        //Add the child blob and assign it to the newChild variable
        newChild = self.addChild(blob);

        //If the child blob has kids of it's own we add those.
        if (blob.children.length > 0) {
            newChild.addChildren(blob.children);
        }
    });
};

/**
 * @desc Removes a child element.
 * @param {number} childIdx - Zero based index of the child element you want to removed.
 */
Transaction.prototype.removeChild = function(childIdx) {
    if (childIdx > -1) {
        this.children.splice(childIdx, 1);
    }
};

/**
 * @desc Delete self from the transaction tree
 * TODO this should throw an error if you try and use it on the root txn.
 */
Transaction.prototype.commitSuicide = function() {
    var i;
    if(this.parentTransaction) {
        i = this.parentTransaction.children.indexOf(this);
        this.parentTransaction.removeChild(i);
    } 
};

/**
 * @desc Updates the value of everything in the Transaction tree.
 * @param {number} amount - how much the silly thing is worth.
 */
Transaction.prototype.setAmount = function(amount) {
    if (this.children.length > 0) {
        this.amount = _.sum(this.children, function(c) {
            return c.getAmount();
        });
    } else {
        this.amount = amount;
    }

    if (this.parent) {
        this.parent.setAmount();
    }
};

/**
 * @desc Figures out how much all of the children elements are worth, and reports the total back, or just returns its value.
 * @returns {number} How much the transaction is worth.
 */
Transaction.prototype.getAmount = function() {
    if (this.children.length > 0) {
        this.amount = _.sum(this.children, function(c) {
            return c.getAmount();
        });
    } 
    return this.amount;
};

/**
 * @desc Creates a complete list of repeated child transactions by initializing each child transactions repeated transactions. This *only* returns 'leaf' transactions that will actually be used in calculating the value of the transaction during a certain boundary period.
 * @param {Bounds} bounds - object containing start and end dates for the transactions to be gathered.
 * @returns {(Transaction|Transaction[])} Transaction object or array of transaction objects.
 */
Transaction.prototype.gatherTransactions = function(bounds) {
    //Leaf case
    if (this.children.length === 0 && this.parentTransaction !== null) {
        this.parentTransaction.accumulator = this.parentTransaction.accumulator.concat(this.initRepeatTransactions(this, bounds));

    //Branch case
    } else if (this.parentTransaction !== null) {
        this.children.forEach(function(c) {
            c.gatherTransactions(bounds);
        });
        this.parentTransaction.accumulator = this.parentTransaction.accumulator.concat(this.initRepeatTransactions(this, bounds));
        this.accumulator = [];

    //Root case
    } else if (this.parentTransaction === null && this.children.length > 0) {
        this.accumulator = [];
        this.children.forEach(function(c) {
            c.gatherTransactions(bounds);
        });
        return this.accumulator;

    //Floater case 
    } else if (this.parentTransaction === null && this.children.length === 0) {
        if(this.frequency !== 'none') {
            return this.initRepeatTransactions(this, bounds);
        } else {
            return this;
        }
    }
};

/**
 * @desc Sets up the transactions repeated transactions, or returns the stashed version of them if nothing has changed.
 * @param {Transaction} txn - Almost always this, but maybe not so we don't get picky.
 * @param {Bounds} bounds - Start and finish date for the transaction.
 * @returns {Transaction[]} All the repeated transactions for the transactions within bounds
 */
Transaction.prototype.initRepeatTransactions = function(txn, bounds) {
    var start, end, i, repeatTxns, series, dates;

    //If the transaction doesn't repeat, don't bother with the rest of this
    //function.
    if (txn.frequency === 'none') { return txn; }

    //Setup start and end dates, startDate needs to be the startDate of the
    //txns, not the bounds start date. (trust me on this one)
    start = moment(txn.startDate);
    end = txn.endDate === 'Invalid Date' || !txn.endDate ? moment(bounds.endDate) : moment(txn.endDate);
    series = this.series;

    //If nothing has changed, return the stashed series...this speeds things
    //up by about 500%;
    if(this.transactionSeries) {
        if (this.transactionSeries.amount === txn.amount &&
                this.transactionSeries.growth === txn.growth &&
                this.transactionSeries.frequency === txn.frequency &&
                this.transactionSeries.startDate === txn.startDate &&
                this.transactionSeries.bounds === bounds) {
                    return this.transactionSeries.txns;
                }
    }

    //Clone our original transaction and create new instances for each one
    //that's been modified.
    dates = this.generateRepeatDates(txn.frequency, start, end);
    repeatTxns = _.map(dates, function(m) {
        var t = _.clone(txn);
        t.startDate = m.toDate();
        t.endDate = null;
        t.frequency = 'none';
        t.series = series;
        return t;
    });

    //Set the growth rate on the repeat txns
    if(txn.growth !== 0 || txn.growth) {
        for(i = 1; i < repeatTxns.length; i++) { //cause POJS is the best sometimes
            repeatTxns[i].amount = repeatTxns[i - 1].amount * (1 + (txn.growth / 100)); //grow each iteration of the txn by growth %
        }
    }

    //Stash our values so we don't have to recalc every time.
    this.transactionSeries = {
        txns: repeatTxns,
        amount: this.amount,
        growth: this.growth,
        frequency: this.frequency,
        startDate: this.startDate,
        bounds: bounds
    };

    //return our values
    return repeatTxns;
};

/**
 * @desc Helper function to generate the dates that are used to initialize the repeated transactions in Transaction#initRepeatTransactions()
 * @param {string} frequency - a string to show how frequently the transaction should be repeated
 * @param {Date} start - Start Date for the transactions
 * @param {Date} end - End Date for the transactions
 * @returns {Transaction[]} An array of repeated transactions.
 */
Transaction.prototype.generateRepeatDates = function(frequency, start, end) {
    var acc = [], range;
    if(['none', 'month', 'week', 'biweek', 'day'].indexOf(frequency) === -1) {
        throw new Error('Frequency must be none, day, week, biweek, or month.');
    }
    if(frequency === 'month') {
        moment().range(start, end).by('months', function(moment) {
            acc.push(moment);
        });
    } else if (frequency === 'week') {
        moment().range(start, end).by('weeks', function(moment) {
            acc.push(moment);
        });
    } else if (frequency === 'biweek') {
        range = moment().range(start, start.clone().add(2, 'weeks'));
        moment().range(start, end).by(range, function(moment) {
            acc.push(moment);
        });
    } else if (frequency === 'day') {
        range = moment().range(start, end).by('days', function(moment) {
            acc.push(moment);
        });
    }
    return acc;
};

/**
 * @desc Finds the value of the collection on a given date
 * @param {Date} date - Date on which we want to know the value of the transaction
 * @param {bounds} bounds - A boundary object with startDate and endDate...
 * @returns {number} The value of the collection on the given date
 */
Transaction.prototype.valueOnDate = function(date, bounds, gatheredTransactions) {
    bounds.endDate = date;
    var gathered = gatheredTransactions ? gatheredTransactions : this.gatherTransactions(bounds);
    var transactions = _(gathered)
        .groupBy(function(txn) {
            return moment(txn.startDate).format('YYYY-MM-DD'); //rounds everything to a day
        })
        .pairs()
        .sortBy(function(t) {
            return moment(t[0]);
        })
        .map(function(k) {
            return {
                date: new Date(k[0]),
                value: _.sum(k[1], function(t) {
                    return t.amount;
                })
            };
        })
        .value();

    var value = _.sum(transactions, function(t) {
        return t.value;
    });
    return value;
}; 


/**
 * @desc Finds all the inflection points on a given TCollection path as well as any points immediately proceeding a crossing of the zero line.
 * @param {Object[]} path - A path generated by the {@link Transaction#generatePath} function.
 * @param {Bounds} bounds - A boundary object with a startDate and endDate for the path.
 * @returns {Object[]} A object with an array of all Zero crossing points and inflection points.
 */
Transaction.prototype.getInflectionZeroPoints = function(path, bounds) {
    return {
        inflectionPts: this.getInflectionPoints(path, bounds),
            zeroPts: this.getZeroPoints(path, bounds)
    };
};

/**
 * @desc Finds all the inflection points on a given path
 * @param {Object[]} path - A path generated by the {@link Transaction#generatePath} function.
 * @partam {Bounds} bounds - Date boundaries for this thing
 * @returns {Object[]} Array of all the local inflection points.
 */
Transaction.prototype.getInflectionPoints = function(path, bounds) {
    var start = moment(bounds.startDate), i, deltaPrime, deltaDPrime, point;
    var accInf = [];
    for(i = 2; i < path.length; i++) {
        deltaPrime = path[i].y - path[i - 1].y;
        deltaDPrime = path[i - 1].y - path[i - 2].y; 
        point = {
            count: i - 1,
            x: path[i - 1].x,
            date:  start.add(path[i - 1].x, 'days').toDate(),
            value: path[i - 1].y,
            type: null 
        };
        if(deltaPrime < 0 && deltaDPrime > 0) {
            point.type = 'max';
            accInf.push(point);
        } else if (deltaPrime > 0 && deltaDPrime < 0) {
            point.type = 'min';
            accInf.push(point);
        }
    }
    return accInf;
};

/**
 * @desc Finds all the points immediately after the the path crosses zero
 * @param {Object} path - A path generated by the {@link Transaction#generatePath} function.
 * @param {Bounds} bounds - Date boundaries of this thing
 * @returns {Object[]} Array of all the zero points
 */
Transaction.prototype.getZeroPoints = function(path, bounds) {
    var start = moment(bounds.startDate), i, point;
    var accZero = [];
    for(i = 2; i < path.length; i++) {
        point = {
            count: i,
            x: path[i].x,
            date:  start.add(path[i].x, 'days').toDate(),
            value: path[i].y,
            type: null 
        };
        if(path[i].y > 0 && path[i - 1].y < 0) {
            point.type = 'positive';
            accZero.push(point);
        } else if (path[i].y < 0 && path[i - 1].y > 0) {
            point.type = 'negative';
            accZero.push(point);
        }
    }
    return accZero;
};

/**
 * @desc Returns an array of objects showing the value of the TCollection on every nth period between newbounds.startDate and newbounds.endDate.
 * @param {String} res - Resolution of the path (can be 'days', 'weeks', 'months)
 * @param {Bounds} bounds - a boundary object specifying what the start and end dates for the path should be
 * @returns {Object[]} An array of objects showing the value of the Collection for the given dates.
 */
Transaction.prototype.generatePath = function(bounds, gatheredTransactions) {
    var start = moment(bounds.startDate);
    //Gather all of the transactions that will be part of the path
    var gathered = gatheredTransactions ? gatheredTransactions : this.gatherTransactions(bounds);
    if(gathered.length === 0) {
        return {
            path: [],
            keyPoints: []
        };
    }

    var transactions = _(gathered)
        .groupBy(function(txn) { //Group transactions by the date on which they occur
            return moment(txn.startDate).format('YYYY-MM-DD'); //rounds everything to a day
        })
        .pairs() //Turns the txn object into arrays
        .sortBy(function(t) {
            return moment(t[0]); //Sorts all the objects by date
        })
        .map(function(k) { //sums up the value of all pairs on a given date
            return {
                date: new Date(k[0]),
                value: _.sum(k[1], function(t) {
                    return t.amount;
                })
            };
        })
        .value();


    transactions = _.reduce(transactions, function(acc, k) {
            acc.push({
                value: -1 * k.value,
                d: k.date,
                x: moment(k.date).diff(start, 'days'),
                y: (acc.length > 0 ? acc[acc.length - 1].y : 0) + k.value
            });
            return acc;
        }, []);

    //fix edge cases where we only have one-time transactions
    //This just adds a point at the right edge of the chart so things don't end
    //mid-stream
    if(transactions[transactions.length - 1].d < bounds.endDate) {
        transactions.push({
            value: transactions[transactions.length -1].value,
            d: bounds.endDate,
            x: moment(bounds.endDate).diff(start, 'days'),
            y: transactions[transactions.length -1].y
        });
    }

    var startValueIdx = _.findIndex(transactions, function(t) {
        return t.d >= bounds.startDate;
    });

    var startValue = startValueIdx > 0 ? {
        d: bounds.startDate,
        x: 0,
        y: transactions[startValueIdx].y
    } : {
        d: bounds.startDate,
        x: 0,
        y: 0
    };


    if(startValueIdx > 0) {
        transactions = transactions.slice(startValueIdx);
    } 
    transactions.unshift(startValue);

    return {
        path: transactions,
        keyPoints: this.getInflectionZeroPoints(transactions, bounds)
    };
};

/**
 * @desc Recursively sets all start dates in a transaction tree to a given date
 * @param {Transaction} [transaction=this] - Transaction that you're setting the start date for
 * @param {Date} startDate - New start date
 * @param {boolean} setall - True if you only want dates less than the start date to be changed, false to change all startDates to the new startDate 
 */
Transaction.prototype.setStartDates = function(transaction, startDate, setall) {
    var self;
    if(!transaction) {
        self = this;
    } else {
        self = transaction;
    }

    if(transaction.startDate < startDate && setall) {
        transaction.startDate = startDate;
    } else if (!setall) {
        transaction.startDate = startDate;
    }

    if (self.children.length > 0) {
        self.children.forEach(function(child) {
            child.setStartDates(null ,startDate);
        });
    }
};

/**
 * @desc Creates a new scenario based on the transaction blob
 * @param {Date} startDate - Date that the scenario starts on
 * @param {string} [name] - Name of the scenario, defaults to 'Scenario 1'
 * @returns {Scenario} The scenario that we just added.
 */
Transaction.prototype.addScenario = function(startDate, name) {
    this.scenarios.push(new Scenario(startDate, name, {
        description: this.description + ' - Scenario' + (this.scenarios.length + 1),
        startDate: startDate
    }, this));
    return this.scenarios[this.scenarios.length - 1];
};

/**
 * @desc Removes a scenario from the list of scenarios for this transaction blob.
 * @param {number} index - Zero-based index for the scenario that you want to delete.
 * @retrums {Scenario[]} The blob's scenario array with the unwanted scenario spliced out.
 */
Transaction.prototype.deleteScenario = function(index) {
    if(index > -1) {
        this.scenarios.splice(index, 1);
    }
};

/** 
 * @desc Generates a RFC4122 v.4 compliant UUID. From http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript 
 * @returns {string} UUID4 string that should be pretty unique.
 */
/* jshint bitwise:false */
Transaction.prototype.generateUUID = function() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = (d + Math.random()*16)%16 | 0;
        d = Math.floor(d/16);
        return (c==='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
};
/* jshint bitwise: true */

////// SCENARIOS LIVE UNDER HERE ///////

/**
 * Method to create a clone of a transaction if no transaction is specified, it
 * clones itself.
 * @param {Transaction} [transaction=this] - The transaction to clone
 * @param {boolean} [divorceParent=false] - Should we keep the reference to the  parent?
 * If this is set to false (default) we also add a reference to the clone to our
 * the list of child transactions.
 * @param {boolean} [newSeries=true] - Is this transaction part of a new series?
 * @returns {Transaction} a clone of the original transaction.
 */
Transaction.prototype.cloneTransaction = function(transaction, divorceParent, newSeries) {
    if (!transaction) { transaction = this; }
    var clone = new Transaction({
        description: transaction.description,
        amount: transaction.amount,
        growth: transaction.growth,
        frequency: transaction.frequency,
        startDate: transaction.startDate,
        endDate: transaction.endDate
    });
    clone.parentTransaction = divorceParent ? null : transaction.parentTransaction;
    clone.series = newSeries ?  transaction.generateUUID() : transaction.series;
    return clone;
};

/**
 * @desc Creates a new Scenario
 * @class Scenario
 * @classdesc a Scenario object with an array of transactions, a startDate, and name.
 * @param {Date} startDate - Date the the scenario splits away from the base transaction blob
 * @param {string} name - The name of the scenario
 * @param {object} blob - Initialization blob for the scenarios that this thing  will hold.
 * @param {Transaction[]} [transactions] - Transactions from the parent blob
 * that should be cloned into the scenario; these transactions will have a start
 * date of the scenario start date.
 */
var Scenario = function(startDate, name, blob, baseTransaction) { //jshint ignore:line
    var initEndDate = moment(startDate).subtract(1, 'days').toDate();
    this.name = name;
    this.startDate = startDate;
    this.transactions = new Transaction(blob);
    this.baseTransaction = baseTransaction;
    this.transactions.addChild({
        description: 'Scenario Initial Amount',
        amount: this.baseTransaction.valueOnDate({
            startDate: null,
            endDate: initEndDate
        }, initEndDate),
        frequency: 'none',
        startDate: this.startDate,
        growth: 0
    });
    return this;
};

/**
 * @desc Clone a transaction from the parent-blob into the scenario
 * @param {Transaction} transaction - The transaction to clone into the scenario blob
 */
Scenario.prototype.cloneTransactionToScenario = function(transaction) {
    //create a deep copy of the transaction 
    var clone = transaction.cloneTransaction(null, true, false);
    //set the start dates for all the transactions
    clone.setStartDates(clone, this.startDate, true);
    //Add the clone to the scenario's transactions
    this.transactions.addChild(clone);
    return this.transactions.children[this.transactions.children.length - 1];
};


/**
 * @desc Get the value of a scenario on a given date
 * @param {date} date - The date that we're trying to get the value for;
 * @returns {number} Value of the scenario on the given date
 */
Scenario.prototype.getValueOnDate = function(bounds) {
    return _(this.gatherTransactions(bounds))
        .sum(function(t) {
            return t.amount;
        });
};

/**
 * Gather all the scenario transactions
 * @param {date} date - Date through which we ought to gather the transactions
 * @param {boolean} [scenarioOnly=false] - Only return scenario transactions,
 * excluding base transactions.
 * @returns {Transaction[]} - The gathered transactions for everything in the
 * scenario.
 */
Scenario.prototype.gatherTransactions = function(bounds, scenarioOnly) {
    var scenario = this;
    var scenarioTransactions= scenario.transactions.gatherTransactions(bounds);
    if(scenarioOnly) {
        return scenarioTransactions;
    } else {
        var scenarioSeriesIDs = _(scenarioTransactions)
            .uniq('series')
            .map(function(t) { return t.series; })
            .value();
        var uniqueBaseTransactions = _(scenario.baseTransaction.gatherTransactions(bounds))
            .filter(function(t) {
                var beforeTxn = t.startDate < scenario.startDate;
                var afterTxn = t.startDate >= scenario.startDate;
                var series = _.includes(scenarioSeriesIDs, t.series);
                return beforeTxn || (afterTxn && !series);
            })
            .value();

        return scenarioTransactions.length > 0 ? scenarioTransactions.concat(uniqueBaseTransactions) : [];
    }
};

/**
 * @desc Remove a transaction and it's children from the Scenario's transactions
 * @param {Transaction} transaction - The transaction to remove.
 */
Scenario.prototype.removeTransactionFromScenario = function(transaction) {
    if(transaction.parentTransaction !== null) {
        transaction.commitSuicide();
    } else {
        this.transactions = null;
    }
};

/**
 * @desc Generates the path for the scenario given the path data for the base transaction
 * @returns {Object} Generated path for the scenario
 */
Scenario.prototype.generateScenarioPath = function(bounds) {
    var gatheredTransactions = this.gatherTransactions(bounds);
    var path = this.baseTransaction.generatePath(bounds, gatheredTransactions);
    return path;
};

////////////////// ACTUAL ANGULAR MODULE //////////////////
if(window.angular) {
    angular.module('brateDevApp')
    .factory('TransactionFactory', function () {
        return Transaction;
    });
}
