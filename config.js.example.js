module.exports = {
	port: 8081,
	secret: 'er989c8ec£$Rev94wvsdf4lkw3',
	comPort: /^ttyUSB0$/,
	database: __dirname+'/cards.sqlite',
	push: {
		id: '12345',
		key: 'ABCDEFGabcdefg'
	},
	users: {
		'paul': {
			password: 'pass',
			pushToken: 'ABCDEFGabcdefg'
		}
	}
};