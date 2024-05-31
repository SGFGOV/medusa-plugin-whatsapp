# Medusa-Plugin-Whatsapp

Bring two poplar platforms together

# Getting started

Installation

```bash
yarn add medusa-plugin-whatsapp
```

# Usage

## Api

Configure the sandbox webhook to point to http://yourserver/whatsapp/received

## License
[MIT](https://choosealicense.com/licenses/mit/)


## Configuration

set the following environment variables. Please use production codes, Test codes don't work with the whatsapp sandbox
```
TWILIO_AUTH_SID= <your twilio auth code> // it begins with AC
TWILIO_AUTH_TOKEN= <your twilio auth token>

#### Only for testing
TEST_SEND_NUMBER= <sandbox number>
TEST_RECIEVER_NUMBER= <your sandbox member number>
```
### in medusa-config.js

add to your plugins list
```
///...other plugins
  {
     resolve:"medusa-plugin-whatsapp":
    {
      options:{
      account_sid: process.env.TWILIO_AUTH_SID,
      auth_token: process.env.TWILIO_AUTH_TOKEN,
      whatsappHandlerInterface:"nameOftheHandlerService"
      }
    }

  }

```

the whatsapp handler service need to implement the interface