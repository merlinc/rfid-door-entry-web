'use strict';

var mocha = require('mocha');

var chai = require('chai');
var should = chai.should();

var DummySerialPort = require('../lib/DummySerialPort');

var checkParserResponse = (expected, done, maxTime) => {
  // expected is a list of response lines
  if(!Array.isArray(expected)) {
    expected = [expected];
  }
  maxTime = maxTime || 500;
  var data = '';

  setTimeout( () => {
    // filter new line delimitered data into array of non-empty response lines
    var found = data
      .split('\r\n')
      .filter( (line) => line !== '' );
    found.should.deep.equal(expected);
    done();
  }, maxTime);

  return (s, buffer) => {
    // gobble up all data returned
    data = data + buffer.toString('ascii');
  };
};

var sendCommand = (port, command) => {
  // send a new line wrapped command to serial port after a short delay to allow it to open
  setTimeout( () => {
    var data = new Buffer('\r\n' + command + '\r\n', 'ascii');
    port.write(data);
  }, 10);
};

describe('DummySerialPort', () => {

  describe('generateId', () => {
    var firstId;

    it('should return a number', () => {
      firstId = DummySerialPort.generateId()
      firstId.should.be.a('number');
    });

    it('should return a different number each time', () => {
      var secondId = DummySerialPort.generateId()
      secondId.should.not.equal(firstId);
    });
  });


  describe('cardToHex', () => {

    it('should return fail if no card given', () => {
      should.throw( () => {
        DummySerialPort.cardToHex();
      }, /No card id specified/);
      should.throw( () => {
        DummySerialPort.cardToHex({});
      }, /No card id specified/);
      should.throw( () => {
        DummySerialPort.cardToHex({id:1234});
      }, /No card id specified/);
    });

    it('should return valid hex card with no level', () => {
      var hex = DummySerialPort.cardToHex({id:'4-12345678901234'});
      hex.should.equal('1234567890123404');
    });


    it('should return valid hex card with level', () => {
      var hex = DummySerialPort.cardToHex({id:'4-12345678901234', level: 7});
      hex.should.equal('1234567890123474');
    });

  });


  describe('hexToCard', () => {

    it('should return fail if no card given', () => {
      should.throw( () => {
        DummySerialPort.hexToCard();
      }, /No card hex specified/);
      should.throw( () => {
        DummySerialPort.hexToCard(1234);
      }, /No card hex specified/);
    });

    it('should return valid card record', () => {
      var hex = DummySerialPort.hexToCard('1234567890123494');
      hex.should.deep.equal({id:'4-12345678901234', level: 9});
    });

  });

  describe('constuctor', () => {
    it('should complain if no options are given', () => {
      should.throw( () => {
        new DummySerialPort();
      }, /Options not specified/);
    });

    it('should complain if no parser function is given', () => {
      should.throw( () => {
        new DummySerialPort(null, {});
      }, /Parser function not specified/);
      should.throw( () => {
        new DummySerialPort(null, {parser: 1234});
      }, /Parser function not specified/);
      should.not.throw( () => {
        new DummySerialPort(null, {parser: () => 0});
      }, /Parser function not specified/);
    });

    it('should assign a name if one is not given', () => {
      var port = new DummySerialPort(null, {parser: () => 0});
      port.name.should.match(/^DummySerialPort\d+$/);
    });

    it('should eventually fire open event', (done) => {
      var port = new DummySerialPort(null, {parser: () => 0, replyDelay: 100});
      port.on('open', done);
    });

  });

  describe('swiping a known card above or at the current level', () => {
    it('should send an access granted response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse([
          'G 1234567890123454',
          'D R',
          'D C'
          ], done),
        replyDelay: 1,
        level: 4,
        doorOpeningDelay: 5,
        cards: [ { id: '4-12345678901234', level: 5 } ]
      });

      port.presentCard('4-12345678901234');
    });
  });

  describe('swiping a known card below the current level', () => {
    it('should send an access denied response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('N 1234567890123454', done),
        replyDelay: 1,
        level: 6,
        cards: [ { id: '4-12345678901234', level: 5 } ]
      });

      port.presentCard('4-12345678901234');
    });
  });

  describe('swiping an uknown card', () => {
    it('should send an unknown card response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('B 1234567890123504', done),
        replyDelay: 1});

      port.presentCard('4-12345678901235');
    });
  });

  describe('programming an unknown card', () => {
    it('should send a card added response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('A 1234567890123564', done),
        replyDelay: 1,
        level: 6,
        cards: [ { id: '4-12345678901234', level: 5 } ]
      });

      port.programCard('4-12345678901235');
    });
  });

  describe('programming an known card', () => {
    it('should send a card removed response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('R 1234567890123454', done),
        replyDelay: 1,
        level: 6,
        cards: [ { id: '4-12345678901234', level: 5 } ]
      });

      port.programCard('4-12345678901234');
    });
  });

  describe('getting current level', () => {
    it('should send a level response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('S 6', done),
        replyDelay: 1,
        level: 6
      });

      sendCommand(port, 'S');
    });
  });

  describe('setting a new level', () => {
    it('should send a level response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('S 7', done),
        replyDelay: 1,
        level: 6
      });

      sendCommand(port, 'S 7');
    });
  });

  describe('asking for a list of all cards', () => {
    it('should send a card list response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse([
          'P 1234567890123454',
          'P FEDCBA98765432B2',
          'P'], done),
        replyDelay: 1,
        level: 6,
        cards: [
          { id: '4-12345678901234', level: 5 },
          { id: '2-FEDCBA98765432', level: 11 }
        ]
      });

      sendCommand(port, 'P');
    });
  });

  describe('asking the id of the reader', () => {
    it('should send an id response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('I C', done),
        replyDelay: 1,
        id: 12,
        level: 6
      });

      sendCommand(port, 'I');
    });
  });

  describe('asking the id of the reader', () => {
    it('should send an id response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse([
          'O',
          'D R',
          'D C'
        ], done),
        replyDelay: 1,
        id: 12,
        level: 6,
        doorOpeningDelay: 5,
      });

      sendCommand(port, 'O');
    });
  });

  describe('sending an unknown command', () => {
    it('should send an error response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse('?', done),
        replyDelay: 1,
        id: 12,
        level: 6
      });

      sendCommand(port, 'Z');
    });
  });


  describe('manually opening the door', () => {
    it('should send a door open and door close response', (done) => {
      var port = new DummySerialPort(null, {
        parser: checkParserResponse([
          'D M',
          'D C'
        ], done),
        replyDelay: 1,
        id: 12,
        level: 6,
        doorOpeningDelay: 5,
      });

      port.manuallyOpenDoor();
    });
  });

});

