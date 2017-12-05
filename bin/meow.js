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

    switch (command) {
        case 'lookup': return (function() {
            return (function() {
                var seq = Promise.resolve();
                opts.args.forEach(function(kittyId) {
                    seq = seq.then(function() {
                        return manager.getKitty(kittyId).then(function(kitty) {
                            console.log('Kitty #' + kitty.id);
                            indented({
                                "Birthdate":   formatDate(kitty.birthTime),
                                "Owner":       kitty.owner,
                                "Generation":  kitty.generation,
                                "Busy Until":  kitty.nextActionAt,
                                "Genes":       kitty.genes,
                                "Matron Id":   String(kitty.matronId),
                                "Sire Id":     String(kitty.sireId),
                                "Siring With": kitty.siringWithId,
                                "URL":         ('https://www.cryptokitties.co/kitty/' + kittyId)
                            });
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
                var json = JSON.parse(fs.readFileSync(opts.args[0]).toString());
                var address = ethers.utils.getAddress(json.address);
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
            var matronId = opts.args.shift();
            var sireId = opts.args.shift();
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
            var kittyId = opts.args.shift();
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
            var matronId = opts.args.shift();
            var sireId = opts.args.shift();

            return (function() {
                return manager.breed(matronId, sireId).then(function(tx) {
                    console.log('Breed');
                    indented({
                        'Transaction': tx.hash
                    });
                });
            });
        })();

        case 'approve': return (function() {
            if (opts.args.length !== 2) { getopts.throwError('approve requires KITTY_ID and ADDRESS'); }
            var kittyId = opts.args.shift();
            var address = opts.args.shift();

            return (function() {
                return manager.approve(kittyId, address).then(function(tx) {
                    console.log('Approve');
                    indented({
                        'Transaction': tx.hash
                    });
                });
            });
        })();

        case 'give-birth': return (function() {
            if (opts.args.length !== 1) { getopts.throwError('approve requires KITTY_ID'); }
            var kittyId = opts.args.shift();

            return (function() {
                return manager.giveBirth(kittyId).then(function(tx) {
                    console.log('Give Birth');
                    indented({
                        'Transaction': tx.hash
                    });
                });
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
    console.log('    meow info FILENAME');
    console.log('');
    console.log('    meow transfer KITTY_ID ADDRESS');
    console.log('');
    console.log('    meow check MATRON_ID SIRE_ID');
    console.log('    meow breed MATRON_ID SIRE_ID');
    console.log('    meow approve KITTY_ID ADDRESS');
    console.log('');
    console.log('    meow give-birth KITTY_ID');
    console.log('');
    console.log('    meow mix-genes GENES1 GENES2 TARGET_BLOCK');
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

