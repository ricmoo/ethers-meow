'use strict';

var ethers = require('ethers');

var kittyCoreInterface = require('./contracts/KittyCore.json');
var saleClockInterface = require('./contracts/SaleClockAuction.json');
var siringClockInterface = require('./contracts/SiringClockAuction.json');

var geneScienceInterface = require('./contracts/GeneScience.json');

var kittyCoreAddress = '0x06012c8cf97BEaD5deAe237070F9587f8E7A266d';
var saleClockAddress = '0xb1690C08E213a35Ed9bAb7B318DE14420FB57d8C';
var siringClockAddress = '0xC7af99Fe5513eB6710e6D5f44F9989dA40F27F26';

// This is static; no need to look it up in the contract
var cooldowns = [
    //uint32(1 minutes),
    (1 * 60),
    //uint32(2 minutes),
    (2 * 60),
    //uint32(5 minutes),
    (5 * 60),
    //uint32(10 minutes),
    (10 * 60),
    //uint32(30 minutes),
    (30 * 60),
    //uint32(1 hours),
    (60 * 60),
    //uint32(2 hours),
    (2 * 60 * 60),
    //uint32(4 hours),
    (4 * 60 * 60),
    //uint32(8 hours),
    (8 * 60 * 60),
    //uint32(16 hours),
    (16 * 60 * 60),
    //uint32(1 days),
    (24 * 60 * 60),
    //uint32(2 days),
    (2 * 24 * 60 * 60),
    //uint32(4 days),
    (4 * 24 * 60 * 60),
    //uint32(7 days)
    (7 * 24 * 60 * 60),
];

var cooldownNames = [
    'fast',
    'swift',
    'snappy',
    'brisk',
    'plodding',
    'slow',
    'sluggish',
    'catatonic'
];

function Kitty(kittyId, details) {
    ethers.utils.defineProperty(this, 'id', kittyId);
    ethers.utils.defineProperty(this, 'matronId', details.matronId.toNumber());
    ethers.utils.defineProperty(this, 'sireId', details.sireId.toNumber());

    ethers.utils.defineProperty(this, 'birthTime', details.birthTime.toNumber());
    ethers.utils.defineProperty(this, 'generation', details.generation.toNumber());

    ethers.utils.defineProperty(this, 'genes', details.genes.toHexString());

    ethers.utils.defineProperty(this, 'cooldownIndex', details.cooldownIndex.toNumber());
    ethers.utils.defineProperty(this, 'nextActionAt', details.nextActionAt.toNumber());

    ethers.utils.defineProperty(this, 'ready', details.isReady);
    ethers.utils.defineProperty(this, 'pregnant', details.isGestating);
    ethers.utils.defineProperty(this, 'siringWithId', details.siringWithId.toNumber());

    ethers.utils.defineProperty(this, 'owner', details.owner);
}


function Manager(providerOrSigner) {
    var signer = null;
    var provider = providerOrSigner;
    if (provider.provider) {
        signer = provider;
        provider = provider.provider;
    }

    ethers.utils.defineProperty(this, 'signer', signer);
    ethers.utils.defineProperty(this, 'provider', provider);

    ethers.utils.defineProperty(this, '_siringClock', new ethers.Contract(siringClockAddress, siringClockInterface, providerOrSigner));
    ethers.utils.defineProperty(this, '_saleClock', new ethers.Contract(saleClockAddress, saleClockInterface, providerOrSigner));
    ethers.utils.defineProperty(this, '_kittyCore', new ethers.Contract(kittyCoreAddress, kittyCoreInterface, providerOrSigner));
}



Manager.prototype.getKitty = function(kittyId) {
    return Promise.all([
        this._kittyCore.getKitty(kittyId),
        this._kittyCore.ownerOf(kittyId),
    ]).then(function(result) {
        result[0].owner = result[1][0];
        return new Kitty(kittyId, result[0]);
    })
}

Manager.prototype.getStatus = function() {
    var toNumber = {
        pregnantKitties: true,
        promoCreatedCount: true,
        secondsPerBlock: true,
        totalSupply: true
    };

    var keys = [
        'autoBirthFee',
        'ceoAddress',
        'cfoAddress',
        'cooAddress',
        'paused',
        'pregnantKitties',
        'promoCreatedCount',
        'secondsPerBlock',
        'symbol',
        'totalSupply',
    ];

    var promises = [];

    keys.forEach(function(key) {
        promises.push(this._kittyCore[key]());
    }, this);

    return Promise.all(promises).then(function(result) {
        var status = {};

        result.forEach(function(result, index) {
            var key = keys[index];
            result = result[0];
            if (toNumber[key]) { result = result.toNumber(); }
            status[key] = result;
        });

        return status;
    });
}

Manager.prototype.getKittyCount = function(address) {
    return this._kittyCore.balanceOf(address).then(function(result) {
        return result[0].toNumber();
    });
}

Manager.prototype.getKittyIds = function(address) {
    console.log(address);
    return this._kittyCore.tokensOfOwner(address).then(function(result) {
        var ids = [];
        result[0].forEach(function(id) {
            ids.push(id.toNumber());
        });
        return ids;
    });
}

Manager.prototype.check = function(matronId, sireId) {
    return Promise.all([
        this._kittyCore.canBreedWith(sireId, matronId),
        this._kittyCore.isReadyToBreed(matronId),
        this._kittyCore.isReadyToBreed(sireId),
    ]).then(function(result) {
        return {
            canBreed: result[0][0],
            matronReady: result[1][0],
            sireReady: result[2][0],
        }
    });
}

Manager.prototype.breed = function(matronId, sireId) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }

    var self = this;

    return Promise.all([
        this.check(matronId, sireId),
        this._kittyCore.ownerOf(matronId),
        this._kittyCore.autoBirthFee()
    ]).then(function(result) {
        console.log(result);
        if (!result[0].canBreed) { throw new Error('kitties cannot breed'); }
        if (!result[0].matronReady) { throw new Error('matron not ready'); }
        if (!result[0].sireReady) { throw new Error('sire not ready'); }
        if (result[1].owner !== self.signer.address) { throw new Error('account does not own matron'); }

        var options = {
            gasLimit: 125000,
            value: result[2][0]
        };

        return self._kittyCore.breedWithAuto(matronId, sireId, options);
    });
}

Manager.prototype.giveBirth = function(kittyId) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }
    var options = {
        gasLimit: 300000
    };
    return this._kittyCore.giveBirth(kittyId, options);
}

Manager.prototype.approveSiring = function(kittyId, address) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }
    var options = {
        gasLimit: 125000
    };
    return this._kittyCore.approveSiring(address, kittyId, options);
}

Manager.prototype.transfer = function(kittyId, address) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }
    var options = {
        gasLimit: 125000
    };
    return this._kittyCore.transfer(address, kittyId, options);
}


Manager.prototype._getAuction = function(contract, kittyId) {
    return Promise.all([
        contract.getAuction(kittyId),
        contract.getCurrentPrice(kittyId),
    ]).then(function(result) {
        return {
            seller: result[0].seller,
            startPrice: result[0].startingPrice,
            endPrice: result[0].endingPrice,
            duration: result[0].duration,
            currentPrice: result[1][0]
        }
    }, function (error) {
        return null;
    });
}


Manager.prototype.getSaleAuction = function(kittyId) {
    return this._getAuction(this._saleClock, kittyId);
}

Manager.prototype.getSiringAuction = function(kittyId) {
    return this._getAuction(this._siringClock, kittyId);
}


Manager.prototype.createSaleAuction = function(kittyId, startPrice, endPrice, duration) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }
    var options = {
        gasLimit: 250000
    };

    return this._kittyCore.createSaleAuction(kittyId, startPrice, endPrice, duration, options);
}

Manager.prototype.createSiringAuction = function(kittyId, startPrice, endPrice, duration) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }
    var options = {
        gasLimit: 250000
    };

    return this._kittyCore.createSiringAuction(kittyId, startPrice, endPrice, duration, options);
}


Manager.prototype.bidOnSaleAuction = function(kittyId) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }

    var self = this;

    return this.getSaleAuction(kittyId).then(function(result) {
        if (result == null) {
            throw new Error('invalid auction');
        }

        var options = {
            gasLimit: 275000,
            value: result.currentPrice
        };

        return self._saleClock.bid(kittyId, options)
    })
}

Manager.prototype.bidOnSiringAuction = function(sireId, matronId) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }

    var self = this;

    return Promise.all([
        this.getSiringAuction(sireId),
        this._kittyCore.autoBirthFee()
    ]).then(function(result) {
        var options = {
            gasLimit: 275000,
            value: result[0].currentPrice.add(result[1][0])
        };

        return self._kittyCore.bidOnSiringAuction(sireId, matronId, options)
    })
}


Manager.prototype.cancelSaleAuction = function(kittyId) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }

    var options = {
        gasLimit: 150000
    };
    return this._saleClock.cancelAuction(kittyId, options);
}

Manager.prototype.cancelSiringAuction = function(kittyId) {
    if (this.signer == null) { return Promise.reject(new Error('missing signer')); }

    var options = {
        gasLimit: 150000
    };
    return this._siringClock.cancelAuction(kittyId, options);
}


Manager.prototype._getGeneScience = function() {
    if (!this._geneSciencePromise) {
        var self = this;
        this._geneSciencePromise = this._kittyCore.geneScience().then(function(result) {
            return new ethers.Contract(result[0], geneScienceInterface, self.provider);
        });
    }
    return this._geneSciencePromise;
}

Manager.prototype.mixGenes = function(genes1, genes2, targetBlock) {
    var self = this;
    return this._getGeneScience().then(function(contract) {
        return contract.mixGenes(genes1, genes2, targetBlock).then(function(result) {
            return result[0];
        });
    });
}


module.exports = {
    Kitty: Kitty,
    Manager: Manager
}
