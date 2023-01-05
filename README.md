<!--lint disable awesome-list-item-->
<div align="center">
  <p align="center">
    <img alt="Medusa" src="https://uploads-ssl.webflow.com/61fba9f6deac297b7b22017d/62000006ce573a706c92546c_logo.svg" width="200" />
  </p>
  <h1>Plugin starter (Typescript)</h1>
  <p>Start to write your own plugin as quick as possible</p>
    
  <a href="https://github.com/adrien2p/awesome-medusajs">
      <img src="https://awesome.re/badge.svg" alt="Awesome">
  </a>
</div>

# Getting started

Installation

```bash
yarn add medusa-plugin-whatsapp
```

# Usage

## Api

## Configuration

set the following environment variables. Please use production codes, Test codes don't work with the whatsapp sandbox

TWILIO_AUTH_SID= <your twilio auth code> // it begins with AC
TWILIO_AUTH_TOKEN= <your twilio auth token>

#### Only for testing
TEST_SEND_NUMBER= <sandbox number>
TEST_RECIEVER_NUMBER= <your sandbox member number>

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
