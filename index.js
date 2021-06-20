const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs-extra')
const fileUpload = require('express-fileupload')
const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectID;
const querystring = require('querystring');
require('dotenv').config();


const app = express()
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: "https://realtime-chat-site.web.app"
  }
});


const PORT = process.env.PORT || 5000

app.use(cors({origin: "https://realtime-chat-site.web.app"}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('service'))
app.use(fileUpload({
  createParentPath: true
}));

app.get('/', (req, res) => {
    res.send('everything is ok')
})

// const io = require('socket.io')

let users = []

const addUser = (userId, socketId) => {
  !users.some((user) => user.userId === socketId) &&
    users.push({userId, socketId})
}

const removeUser = (socketId) => {
  users = users.filter(user => user.socketId !== socketId)
}

const getUser = (userID) => {
  return users.find((user) => user.userId === userID);
};

io.on('connection', (socket) => {
  // when connect
  console.log('a user connected')
  // adding user to socket server
  socket.on('addUser', (userId) => {
    addUser(userId, socket.id)
    io.emit('getSocketUsers', users)
  })

  // send and get message
  socket.on("sendMessage", ({ messageId, sendId, receiverId, message }) => {
    const user = getUser(receiverId);
    if (user) {
      io.to(user.socketId).emit("getMessage", {
        sendId,
        messageId,
        message,
      });
    }
  });

  // Start New Conversation
  socket.on("newConversation", (userID) => {
    const user = getUser(userID.userID)
    console.log(userID);
    console.log(users)
    console.log(user)
    if (user) {
      io.to(user.socketId).emit("startConversation", {
        userID,
        startConversation: true
      })
    }
  })

  // when disconnect
  socket.on('disconnect', () => {
    console.log('a user disconnected')
    removeUser(socket.id)
    io.emit('getSocketUsers', users)
  })
})

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASS}@cluster0.xxb2u.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

// users data collection
client.connect(err => {
  const usersCollection = client.db(process.env.DB_NAME).collection(process.env.DB_USERS_DATA_COLLECTION);

  app.post('/register-user', (req, res) => {
    const data = req.body
    usersCollection.insertOne(data)
    .then(result => {
      res.send(result)
    })
    .catch(err => console.log(err))
  })

  app.get('/get-user', (req, res) => {
    usersCollection.find({})
    .toArray( (err, documents) => {
        res.send(documents)
    })
    // .catch(err => console.log(err))
  })

  app.patch('/user-message-update/id',(req, res)=>{
    const id = req.query.id;
    const body = req.body;

    usersCollection.find({_id: ObjectId(id)})
    .toArray( (err, documents) => {
          let messageArray = documents[0].messages;
          if (messageArray === undefined) {
            messageArray = [body];
          }
          else {
            messageArray.push(body)
          }
          usersCollection.updateOne(
            { _id: ObjectId(id) },
            {
              $set: { messages: messageArray },
            }
        )
      })
      
    // const {status} = body;
    
    // .then(result => res.send(result.modifiedCount))
  })

  app.patch('/add-conversation-to-top',(req, res)=>{
    const body = req.body;
    const {id, data} = body;
    // console.log(id, data)
      usersCollection.updateOne(
        { _id: ObjectId(id) },
        {
          $set: { messages: data},
        }
    )
    .then(result => res.send(result.modifiedCount))
  })
})

client.connect(err => {
  const messagesCollection = client.db(process.env.DB_NAME).collection(process.env.DB_MESSAGES_COLLECTION);

  app.post('/start-message', (req, res) => {
    const data = req.body
    messagesCollection.insertOne(data)
    .then(result => {
      res.send(result)
    })
    .catch(err => console.log(err))
  })

  app.get('/get-messages', (req, res) => {
    messagesCollection.find({})
    .toArray( (err, documents) => {
        res.send(documents)
    })
  })

  app.patch('/add-message/id',(req, res)=>{
    const id = req.query.id;
    const body = req.body;

    messagesCollection.find({_id: ObjectId(id)})
    .toArray( (err, documents) => {
          let messageArray = documents[0].messages;
          if (messageArray === undefined) {
            messageArray = [body];
          }
          else {
            messageArray.push(body)
          }
          messagesCollection.updateOne(
            { _id: ObjectId(id) },
            {
              $set: { messages: messageArray },
            }
        )
      })
      
  })
})

server.listen(PORT, () => {
  console.log('listening on *:5000');
});
// app.listen(PORT)