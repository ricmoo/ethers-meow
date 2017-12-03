Ethers-Meow
===========

A simple [CryptoKitties](https://www.cryptokitties.co)
JavaScript library and command-line tool.

This is **HIGHLY** experimental. More documentation coming soon.


Installing
----------

```
/Users/ricmoo> npm install -g ethers-meow
```

-----

Command-Line Interface
======================

```
Command Lime Interface - meow/0.0.1

Usage:

    meow lookup [ KITTY_ID ... ]
    meow status

    meow init FILENAME
    meow info FILENAME

    meow transfer KITTY_ID ADDRESS

    meow check MATRON_ID SIRE_ID
    meow breed MATRON_ID SIRE_ID
    meow approve KITTY_ID ADDRESS

    meow give-birth KITTY_ID

Node Options
  --rpc URL             Use the Ethereum node at URL

Account Options
  --account FILENAME    Use the JSON wallet

Transaction Options
  --gas-price GWEI      Override the gas price
  --nonce NONCE         Override the nonce (.sol only)

Options
  --help                Show this help
  --version             Show the version
```

Examples
--------

### General Details (read-only)

**Lookup kitties by ID**

```
/Users/ricmoo> meow lookup 20000 27500
Kitty #20000
  Birthdate:    2017-12-02 02:17:05
  Busy Until:   0
  Genes:        0x4212b39ce50b8c3729e90000331c845196c1806a214e6196277b929639ce
  Matron Id:    19709
  Owner:        0x8ba1f109551bD432803012645Ac136ddd64DBA72
  Sire Id:      6710
  Siring With:  0
  URL:          https://www.cryptokitties.co/kitty/20000
Kitty #27500
  Birthdate:    2017-12-02 02:17:05
  Busy Until:   0
  Genes:        0x4ad28398a7184667b94f1800031a64435ac31a1039a67118c77bae872dcc
  Matron Id:    15937
  Owner:        0x8ba1f109551bD432803012645Ac136ddd64DBA72
  Sire Id:      27359
  Siring With:  0
  URL:          https://www.cryptokitties.co/kitty/27500
```


**Show contract status**

```
/Users/ricmoo> meow status
CryptoKitties Status
  autoBirthFee:       0.001
  ceoAddress:         0xaf1E54B359B0897133F437Fc961DD16F20c045E1
  cfoAddress:         0x2041BB7D8b49F0bDE3aa1Fa7Fb506ac6C539394C
  cooAddress:         0xba52c75764d6F594735dc735Be7F1830CDf58dDf
  paused:             false
  pregnantKitties:    1779
  promoCreatedCount:  3000
  secondsPerBlock:    15
  symbol:             CK
  totalSupply:        28498
```


### Accounts

**Create a new JSON wallet**

```
/Users/ricmoo> meow init account.json
Creating new Account: account.json
Do NOT lose or forget this password. It cannot be reset.
New Account Password: ******
Confirm Password: ******
Encrypting Account... (this may take a few seconds)
Account successfully created. Keep this file SAFE. If you lose
it or forget your password, your CryptoKitties are LOST FOREVER.
Your address is: 0x44f1153EA1900Bcb8E0883B8561d51CCd6f48693
```

**Get account information**

```
/Users/ricmoo> meow info account.json
Wallet Status
  Address::         0x8b5ebdc77dd2c746b49ED198df2BC1a26aeEF425
  Balance:          0.0087824799
  Kitties:          2
  Nonce (latest):   2
  Nonce (pending):  2
  URL:              https://www.cryptokitties.co/profile/0x8b5ebdc77dd2c746b49ed198df2bc1a26aeef425
```


### Transfer

```
/Users/ricmoo> meow transfer 10053 0x8ba1f109551bd432803012645ac136ddd64dba72 --account account.json
Sign Transaction:
    Network:       mainnet
    From:          0x8b5ebdc77dd2c746b49ED198df2BC1a26aeEF425
    To:            0x06012c8cf97BEaD5deAe237070F9587f8E7A266d
    Gas Price:     2.1 Gwei
    Gas Limit:     1500000
    Nonce:         undefined
    Value:         0.0 ether
    Data:          68 bytes
Account Password (mainnet:account.json): ******
Transfer
  Transaction:  0x780d48482957a3beac372643ae1fde62c91f422c16ac8958450ea6591933cea6
```


### Breeding

**Check that breeding is allowed**

All three fields must be `yes` for breeding to be successful.

```
/Users/ricmoo> meow check 27500 20000
Check
  Sire Ready:    yes
  Matron Ready:  yes
  Can Breed:     yes
```

**Breed two kitties together**

```
/Users/ricmoo> meow breed 13968 10053 --account account.json 
Sign Transaction:
    Network:       mainnet
    From:          0x8b5ebdc77dd2c746b49ED198df2BC1a26aeEF425
    To:            0x06012c8cf97BEaD5deAe237070F9587f8E7A266d
    Gas Price:     2.1 Gwei
    Gas Limit:     125000
    Nonce:         undefined
    Value:         0.001 ether
    Data:          68 bytes
Account Password (mainnet:account.json): ******
Breed
  Transaction:  0x6e397a3d3a054e1241a3e1356cd4c567bedcbaf27457aba48a2a44c8b0aea2f7
```

**Approve another account to breed with your kitty**

```
/Users/ricmoo> meow approve 13968 0x8ba1f109551bd432803012645ac136ddd64dba72 --account account.json 
Sign Transaction:
    Network:       mainnet
    From:          0x8b5ebdc77dd2c746b49ED198df2BC1a26aeEF425
    To:            0x06012c8cf97BEaD5deAe237070F9587f8E7A266d
    Gas Price:     2.1 Gwei
    Gas Limit:     1500000
    Nonce:         undefined
    Value:         0.0 ether
    Data:          68 bytes
Account Password (mainnet:account.json): ******
Approve
  Transaction:  0xcd8f98a301bec493525255e5c2b3abb19f16508d994b222b0050e44ab991f81c
```

-----

API
===

Setup Manager
-------------

**Read-Only Setup**

```javascript
var meow = require('ethers-meow');

var ethers = require('ethers');
var provider = ethers.providers.getDefaultProvider();

var manager = new meow.Manager(provider);
```

**Write Setup**

```javascript
var meow = require('ethers-meow');

var ethers = require('ethers');
var provider = ethers.providers.getDefaultProvider();

var privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';

var wallet = new ethers.Wallet(privateKey, provider);

var manager = new meow.Manager(wallet)
```

General Details (readonly)
--------------------------

**Manager.prototype.getKitty ( kittyId )**

```javascript
manager.getKitty(20000).then(function(kitty) {
    console.log(kitty);
});
```

**Manager.prototype.getStatus ( )**

```javascript
manager.getStatus().then(function(status) {
    console.log(status);
});
```

Transfer
--------

```
var kittyId = 20000;
var address = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
manager.transfer(kittyId, address).then(function(transactionHash) {
    console.log(transactionHash);
});

Breeding
--------

**Checking that breeding is viable**

```javascript
var matronId = 20000;
var sireId = 27500
manager.check(matronId, sireId).then(function(result) {
    console.log(result);
});
```

**Breed two kitties together**

```javascript
var matronId = 20000;
var sireId = 27500
manager.breed(matronId, sireId).then(function(transactionHash) {
    console.log(transactionHash);
});
```

**Approve another account to breed with you kitty**

```
var kittyId = 20000;
var address = '0x8ba1f109551bD432803012645Ac136ddd64DBA72';
manager.approve(kittyId, address).then(function(transactionHash) {
});
```

**Birthing a new kitty**

Once a kitty is has baked in the oven long enough, you may call this to
birth it. Generally this is called for you by the CryptoKitty birthing
service.

The first caller to this receives the `autoBirthFee` that was sent during
the call to breed. All callers after simply burn gas, and there are many
people competing to birth your kitty.

```javascript
manager.giveBirth(10000).then(funtion(transactionHash) {
    console.log(transactionHash);
});
```

-----

License
-------

MIT License.

-----

Donations
---------

I build these tools in my spare time for fun, but if you would like to buy me
a coffee or send a kitty my way, it is always appreciated. 

**Ethereum Address:** `0x216174A07797bab4DcFf2e2D673BC159237561D2`
