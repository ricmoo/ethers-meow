#!/usr/bin/env node

'use strict';

var fs = require('fs');

var ethers = require('ethers');
var getopts = require('ethers-cli/lib/getopts');

var meow = require('../index');
var version = require('../package.json').version;

function pad(text, length) {
    while (text.length < length) { text += ' '; }
    return text;
}

function indented(data) {
    var maxLength = 0;
    for (var key in data) {
        if (key.length > maxLength) { maxLength = key.length; }
    }
    for (var key in data) {
        console.log('  ' + pad(key + ': ', maxLength + 3) + data[key]);
    }
}

function zpad(v, length) {
    v = String(v);
    while (v.length < length) { v = '0' + v; }
    return v;
}
function formatDate(seconds) {
    var date = new Date(1512199025 * 1000);
    return [
        [ date.getFullYear(), zpad(date.getMonth() + 1, 2), zpad(date.getDate(), 2) ].join('-'),
        [ zpad(date.getHours(), 2), zpad(date.getMinutes(), 2), zpad(date.getSeconds(), 2) ].join(':')
    ].join(' ');
}

var options = {
    help: false,
    version: false,

    photo: false,

    token: '',

    _accounts: true,
    _provider: true,
    _promises:true
};


getopts(options).then(function(opts) {
    if (opts.options.help) { getopts.throwError(); }

    if (opts.options.version) {
        console.log('ethers-build/' + version);
        return function() { }
    }

    if (opts.args.length == 0) { getopts.throwError('no command'); }
    var command = opts.args.shift();

    var providerOrSigner = opts.provider;

    if (opts.accounts.length > 0) {
        if (opts.accounts.length > 1) { getopts.throwError('too many --account'); }
        providerOrSigner = opts.accounts[0];
    }

    var manager = new meow.Manager(providerOrSigner);

    function transactionDump(heading) {
        return function(tx) {
            console.log(heading);
            indented({
                'Transaction': tx.hash
            });
        }
    }

    switch (command) {
        case 'lookup': return (function() {
            return (function() {
                var seq = Promise.resolve();
                opts.args.forEach(function(kittyId) {
                    kittyId = ethers.utils.bigNumberify(kittyId);

                    seq = seq.then(function() {
                        return Promise.all([
                            manager.getKitty(kittyId),
                            manager.getSaleAuction(kittyId),
                            manager.getSiringAuction(kittyId),
                        ]).then(function(result) {
                            var kitty = result[0];
                            console.log('Kitty #' + kitty.id);
                            indented({
                                "Birthdate":   formatDate(kitty.birthTime),
                                "Busy Until":  kitty.nextActionAt,
                                "Generation":  kitty.generation,
                                "Genes":       kitty.genes,
                                "Matron Id":   String(kitty.matronId),
                                "Owner":       kitty.owner,
                                "Sire Id":     String(kitty.sireId),
                                "Siring With": kitty.siringWithId,
                                "URL":         ('https://www.cryptokitties.co/kitty/' + kittyId)
                            });
                            function dumpAuction(heading, auction) {
                                console.log(heading);
                                indented({
                                    "Seller":        auction.seller,
                                    "Current Price": ethers.utils.formatEther(auction.currentPrice),
                                    "Start Price":   ethers.utils.formatEther(auction.startPrice),
                                    "End Price":     ethers.utils.formatEther(auction.endPrice),
                                    "Duration":      auction.duration
                                });
                            }
                            if  (result[1]) {
                                dumpAuction('For Sale', result[1]);
                            }
                            if  (result[2]) {
                                dumpAuction('For Sire', result[2]);
                            }
                        });
                    });
                });
                return Promise.resolve();
            });
        })();

        case 'status': return (function() {
            return (function() {
                return manager.getStatus().then(function(status) {
                    console.log('CryptoKitties Status');
                    status.autoBirthFee = ethers.utils.formatEther(status.autoBirthFee);
                    indented(status);
                });
            });
        })();

        case 'info': return (function() {
            if (opts.args.length !== 1) { getopts.throwError('info requires FILENAME'); }

            return (function() {
                try {
                    var address = ethers.utils.getAddress(opts.args[0]);
                } catch (error) {
                    var json = JSON.parse(fs.readFileSync(opts.args[0]).toString());
                    var address = ethers.utils.getAddress(json.address);
                }

                return Promise.all([
                    opts.provider.getBalance(address),
                    opts.provider.getTransactionCount(address, 'latest'),
                    opts.provider.getTransactionCount(address, 'pending'),
                    manager.getKittyCount(address)
                ]).then(function(result) {
                    console.log('Wallet Status');
                    indented({
                        "Address:":        address,
                        "Balance":         ethers.utils.formatEther(result[0]),
                        "Kitties":         result[3],
                        "Nonce (latest)":  result[1],
                        "Nonce (pending)": result[2],
                        "URL":             ('https://www.cryptokitties.co/profile/' + address.toLowerCase())
                    });
                });
            });
        })();

        case 'init': return (function() {
            if (opts.args.length === 0) { getopts.throwError('init requires FILENAME'); }
            var filename = opts.args.shift();

            return (function() {
                if (fs.existsSync(filename)) {
                    getopts.throwError('File already exists!');
                }

                var account = ethers.Wallet.createRandom();

                console.log('Creating new Account: ' + filename);
                console.log('Do NOT lose or forget this password. It cannot be reset.');

                var password = getopts.getPassword('New Account Password: ');
                var confirmPassword = getopts.getPassword('Confirm Password: ');
                if (Buffer.compare(password, confirmPassword) !== 0) {
                    getopts.throwError('Passwords did NOT match. Aborting.');
                }

                console.log('Encrypting Account... (this may take a few seconds)');
                return account.encrypt(password).then(function(json) {
                    try {
                        fs.writeFileSync(filename, json, {flag: 'wx'});
                        console.log('Account successfully created. Keep this file SAFE. If you lose');
                        console.log('it or forget your password, your CryptoKitties are LOST FOREVER.');
                        console.log('Your address is: ' + account.address);
                    } catch (error) {
                        getopts.throwError('Error saving account.js: ' + error.message);
                    }
                }, function(error) {
                    getopts.throwError('Error encrypting account: ' + error.message);
                });
            });
        })();

        case 'list': return (function() {
            if (opts.args.length !== 1) { getopts.throwError('list requires exactly one ADDRESS'); }
            var address = opts.args.shift();

            return (function() {
                console.log('WARNING: This operation often fails (it is computational expensive)');

                return manager.getKittyIds(address).then(function(kittyIds) {
                    if (kittyIds.length) {
                        console.log(kittyIds.join(', '));
                    } else {
                        console.log('no kitties found (or node ignored list request)');
                    }
                });
            });
        })();

        case 'check': return (function() {
            if (opts.args.length !== 2) { getopts.throwError('check requires MATRON_ID and SIRE_ID'); }
            var matronId = ethers.utils.bigNumberify(opts.args.shift());
            var sireId = ethers.utils.bigNumberify(opts.args.shift());

            return (function() {
                return manager.check(matronId, sireId).then(function(status) {
                    console.log('Check');
                    indented({
                        'Sire Ready': (status.sireReady ? 'yes': 'no'),
                        'Matron Ready': (status.matronReady ? 'yes': 'no'),
                        'Can Breed': (status.canBreed ? 'yes': 'no')
                    });
                });
            });
        })();

        case 'transfer': return (function() {
            if (opts.args.length !== 2) { getopts.throwError('transfer requires KITTY_ID and ADDRESS'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());
            var address = opts.args.shift();

            return (function() {
                return manager.transfer(kittyId, address).then(function(tx) {
                    console.log('Transfer');
                    indented({
                        'Transaction': tx.hash
                    });
                });
            });
        })();

        case 'breed': return (function() {
            if (opts.args.length !== 2) { getopts.throwError('breed requires MATRON_ID and SIRE_ID'); }
            var matronId = ethers.utils.bigNumberify(opts.args.shift());
            var sireId = ethers.utils.bigNumberify(opts.args.shift());

            return (function() {
                return manager.breed(matronId, sireId).then(transactionDump('Breed'));
            });
        })();

        /*
        // Still too experimental
        case 'auto-breed': return (function() {
            if (opts.args.length < 2) { getopts.throwError('auto-breed requires at least two KITTY_ID'); }
            var kittyIds = opts.args;

            function getShuffled() {
                var round = [];
                kittyIds.forEach(function(kittyId) { round.push(kittyId); });

                // https://bost.ocks.org/mike/shuffle/
                var m = round.length;
                while (m > 0) {
                    var i = Math.floor(Math.random() * (m--));
                    var t = round[m];
                    round[m] = round[i];
                    round[i] = t;
                }

                return round;
            }

            return (function() {
                function runBreed() {
                    var round = getShuffled();
                    var pairs = {};

                    //console.log(providerOrSigner);
                    //var seq = providerOrSigner.sign('Hello World');

                    var seq = Promise.resolve();

                    for (var i = 0; i < round.length; i++) {
                        for (var j = i + 1; j < round.length; j++) {
                            (function(i, j) {
                                seq = seq.then(function() {
                                    var ri = round[i], rj = round[j];
                                    if (pairs[ri] != null || pairs[rj] != null) { return; }
                                    return manager.check(ri, rj).then(function(result) {
                                        if (result.canBreed && result.sireReady && result.matronReady) {
                                            pairs[ri] = rj;
                                            pairs[rj] = ri;
                                        }
                                    });
                                });
                            })(i, j)
                        }
                    }

                    seq.then(function() {
                        var done = {};
                        var seq = Promise.resolve();

                        for (var i = 0; i < round.length; i++) {
                            (function(matronId) {
                                var sireId = pairs[matronId];
                                if (sireId == null || done[matronId] || done[sireId]) { return; }
                                done[matronId] = true;
                                done[sireId] = true;

                                seq = seq.then(function() {
                                    console.log('Breeding:', matronId, '+', sireId);
                                    return manager.breed(matronId, sireId).then(function(tx) {
                                        console.log(tx);
                                    }, function(error) {
                                        console.log(error);
                                    }).then(function() {
                                        return new Promise(function(resolve) {
                                            setTimeout(function() {
                                                resolve();
                                            }, 5000);
                                        });
                                    });
                                });
                            })(round[i]);
                        }

                        seq.then(function() {
                            console.log('Done round');
                        });
                    });

                }
                setInterval(runBreed, (10 * 60 * 1000));
                runBreed();
                return new Promise(function(resolve, reject) { });
                return new Promise(function(resolve, reject) {
                    
                    function breed() {
                        manager.check(matronId, sireId).then(function(result) {
                            console.log(result);
                            if (!result.canBreed) {
                                reject(new Error('kitties cannot breed'));
                                return;
                            }

                            if (!result.sireReady || !result.matronReady) {
                                console.log('Need more time...');
                                return;
                            }

                            console.log('breeding');
                            manager.breed(matronId, sireId).then(function(tx) {
                                console.log(tx);
                            });
                        });
                    }

                    setInterval(breed, (1000 * 60 * 5));
                    breed();
                });
            });
        })();
        */

        // Needs more testing
        case 'approve-siring': return (function() {
            if (opts.args.length !== 2) { getopts.throwError('approve-siring requires KITTY_ID and ADDRESS'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());
            var address = ethers.utils.getAddress(opts.args.shift());

            return (function() {
                return manager.approveSiring(kittyId, address).then(transactionDump('Approve Siring'));
            });
        })();

        case 'give-birth': return (function() {
            if (opts.args.length !== 1) { getopts.throwError('give-birth requires KITTY_ID'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());

            return (function() {
                return manager.giveBirth(kittyId).then(transactionDump('Give Birth'));
            });
        })();

        case 'sale-create': return (function() {
            if (opts.args.length !== 4) { getopts.throwError('sale-create requires KITTY_ID, START_PRICE, END_PRICE and DURATION_HOURS'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());
            var startPrice = ethers.utils.parseEther(opts.args.shift());
            var endPrice = ethers.utils.parseEther(opts.args.shift());

            var duration = opts.args.shift();
            if (parseInt(duration) != duration) {
                getOpts.throwError('invalid duration - ' + duration);
            }
            duration = parseInt(duration) * 3600;

            return (function() {
                return manager.createSaleAuction(kittyId, startPrice, endPrice, duration).then(transactionDump('Create Sale Auction'));
            });
        })();

        case 'siring-create': return (function() {
            if (opts.args.length !== 4) { getopts.throwError('siring-create requires KITTY_ID, START_PRICE, END_PRICE and DURATION_HOURS'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());
            var startPrice = ethers.utils.parseEther(opts.args.shift());
            var endPrice = ethers.utils.parseEther(opts.args.shift());

            var duration = opts.args.shift();
            if (parseInt(duration) != duration) {
                getOpts.throwError('invalid duration - ' + duration);
            }
            duration = parseInt(duration) * 3600;

            return (function() {
                return manager.createSiringAuction(kittyId, startPrice, endPrice, duration).then(transactionDump('Create Siring Auction'));
            });
        })();


        case 'sale-bid': return (function() {
            if (opts.args.length !== 1) { getopts.throwError('sale-bid requires KITTY_ID'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());

            return (function() {
                return manager.bidOnSaleAuction(kittyId).then(transactionDump('Bid On Sale Auction'));
            });
        })();

        case 'siring-bid': return (function() {
            if (opts.args.length !== 2) { getopts.throwError('siring-bid requires OTHER_SIRE_ID MY_MATRON_ID'); }
            var sireId = ethers.utils.bigNumberify(opts.args.shift());
            var matronId = ethers.utils.bigNumberify(opts.args.shift());

            return (function() {
                return manager.bidOnSiringAuction(sireId, matronId).then(transactionDump('Bid On Siring Auction'));
            });
        })();


        case 'sale-cancel': return (function() {
            if (opts.args.length !== 1) { getopts.throwError('sale-cancel requires KITTY_ID'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());

            return (function() {
                return manager.cancelSaleAuction(kittyId).then(transactionDump('Cancel Sale Auction'));
            });
        })();

        case 'siring-cancel': return (function() {
            if (opts.args.length !== 1) { getopts.throwError('siring-cancel requires KITTY_ID'); }
            var kittyId = ethers.utils.bigNumberify(opts.args.shift());

            return (function() {
                return manager.cancelSiringAuction(kittyId).then(transactionDump('Cancel Siring Auction'));
            });
        })();

        case 'mix-genes': return (function() {
            if (opts.args.length !== 3) { getopts.throwError('mix-genes requires GENES1, GENES2 and TARGET_BLOCK'); }
            var genes1 = ethers.utils.bigNumberify(opts.args.shift());
            var genes2 = ethers.utils.bigNumberify(opts.args.shift());
            var targetBlock = parseInt(opts.args.shift());

            return (function() {
                return manager.mixGenes(genes1, genes2, targetBlock).then(function(result) {
                    console.log('Mix Genes');
                    result = result.toHexString();
                    while (result.length < 66) { result = '0x0' + result.substring(2); }
                    indented({
                        'Genes': result
                    });
                });
            });
        })();

        case 'rename': return (function() {
            if (opts.args.length !== 2) { getopts.throwError('rename requires KITTY_ID and NAME'); }
            var kittyId = parseInt(opts.args.shift());
            var name = opts.args.shift();
            return (function() {
                return manager.rename(kittyId, name).then(function(result) {
                    console.log(result);
                });
            });
        })();

        default:
            getopts.throwError('unknown command - ' + command);
    }

}).then(function(run) {
    return run();

}, function (error) {
    console.log('');
    console.log('Command Lime Interface - meow/' + version);
    console.log('');
    console.log('Usage:');
    console.log('');
    console.log('    meow lookup [ KITTY_ID ... ]');
    console.log('    meow list ADDRESS');
    console.log('    meow status');
    console.log('');
    console.log('    meow init FILENAME');
    console.log('    meow info ( FILENAME | ADDRESS )');
    console.log('');
    console.log('    meow transfer KITTY_ID ADDRESS');
    console.log('');
    console.log('    meow check MATRON_ID SIRE_ID');
    console.log('    meow breed MATRON_ID SIRE_ID');
    console.log('    meow approve-siring KITTY_ID ADDRESS');
    console.log('');
    console.log('    meow give-birth KITTY_ID');
    console.log('');
    console.log('    meow sale-create KITTY_ID START_PRICE END_PRICE DURATION_HOURS');
    console.log('    meow sale-bid KITTY_ID');
    console.log('    meow sale-cancel KITTY_ID');
    console.log('');
    console.log('    meow siring-create KITTY_ID START_PRICE END_PRICE DURATION_HOURS');
    console.log('    meow siring-bid OTHER_SIRE_ID MY_MATRON');
    console.log('    meow siring-cancel KITTY_ID');
    console.log('');
    console.log('    meow mix-genes GENES1 GENES2 TARGET_BLOCK');
    console.log('');
    console.log('    meow rename KITTY_ID NAME');
    console.log('');
    console.log('Node Options');
    console.log('  --rpc URL             Use the Ethereum node at URL');
    console.log('');
    console.log('Account Options');
    console.log('  --account FILENAME    Use the JSON wallet');
    console.log('');
    console.log('Transaction Options');
    console.log('  --gas-price GWEI      Override the gas price');
    console.log('  --nonce NONCE         Override the nonce (.sol only)');
    console.log('  --value ETHER         Send ether (.sol only)');
    console.log('');
    console.log('Options');
    console.log('  --help                Show this help');
    console.log('  --version             Show the version');

    if (error.message) { throw error; }
    console.log('');

}).catch(function(error) {
    console.log('');
    if (!error._messageOnly) {
        console.log(error.stack);
    } else {
        console.log('Error: ' + error.message);
    }
    console.log('');
});

