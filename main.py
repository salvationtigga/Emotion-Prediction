from tensorflow.keras.preprocessing.sequence import pad_sequences
from tensorflow.keras.preprocessing.text import Tokenizer
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from keras.models import load_model
import numpy as np
import pickle
import re






model_path = r'C:\Salvation\python\Deep Learning\Sentiments project\BiGRU_Model.keras'

tokenizer_path = r'C:\Salvation\python\Deep Learning\Sentiments project\tokenizer.pkl'

max_sequence_length = 50
emotion_labels = ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise']

EMOTION_EMOJIS = {
    "sadness": "😢",
    "joy": "😂",
    "love": "❤️",
    "anger": "😡",
    "fear": "😨",
    "surprise": "😲"
}

#clean raw text so it matches the format used while training

def preprocess_text(text:str)->str:
    text = text.lower()
    text = re.sub(r"'","",text)
    text = re.sub(r"[^a-z0-9\s]"," ", text)
    text = re.sub(r"\s+", " ",text).strip()
    return text

"""
request and response schemas
"""

class TextInput(BaseModel):
    text : str = Field(
        ...,
        min_length=1,
        max_length=2000,
        descrtiption='the sentence to analyze',
        json_schema_extra={"example":"I feel so happy and excited"}
        )
    

class PredictionResponse(BaseModel):
    text: str
    predicted_emotion: str
    confidence : float
    all_probabilities: dict[str,float]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool

"""
#model loading and lifespan management
load the model and toknizer once the server starts up
"""

dl_model = {}

async def lifespan(app: FastAPI):
    print("Loading the model and tokenizer...")
    dl_model["BiGRU"] = load_model(model_path)  #Bigru model
    with open(tokenizer_path, 'rb') as file:
        dl_model["Tokenizer"]= pickle.load(file)
    print('Model are loaded successfully...')

    yield #pause, model is loaded and server is running and at this point model will wait for request

    dl_model.clear() #ek baar server band ho jaye uske baad model ko memory se hata do


'''
mount the static files 
'''
app = FastAPI(
    lifespan=lifespan
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.mount('/static', StaticFiles(directory='static'), name='static')


"""
API Endpoints
A.server UI at homepage('/')
B.health check endpoint ('/')
C.predict emotion endpoint('/')

"""
#A. server ui at homepage('/')
@app.get('/', include_in_schema=False)
def server_ui():
    return FileResponse('static/index.html')

#b. health check endpoint('/health')
@app.get('/health', response_model=HealthResponse)
def health_check():
    return HealthResponse(status='Server is running',model_loaded=bool(dl_model))

#c. predict emotion endpoint('/predict')
@app.post('/predict', response_model=PredictionResponse)
def predict_emotion(text_input: TextInput):
    
    
    """
     1. cleans the input sentences
     2. convert the words into numeric using tokenizer
     3. pad the sequences to ensure uniform length
     4. run prediction using the bigru model
     5. return the top emotion and full probability breakdown
    """

    BiGRU_model     = dl_model.get("BiGRU")
    tokenizer_model = dl_model.get("Tokenizer")

    if BiGRU_model is None or tokenizer_model is None:
        raise HTTPException(status_code=503, detail= "Model is not loaded yet. Please try again later.")    


    #1.
    cleaned_text = preprocess_text(text_input.text)

    #2. and 3.
    tokenized_text = tokenizer_model.texts_to_sequences([cleaned_text])
    padded_sequences = pad_sequences(
        tokenized_text,
        maxlen= max_sequence_length,
        padding="post",
        truncating='post'

    )
    probabilities = BiGRU_model.predict(padded_sequences)[0]

    top_emotion_index = int(np.argmax(probabilities))
    all_probabilities = {
    label: float(prob) for prob, label in zip(probabilities, emotion_labels)

    }

    return PredictionResponse(
        text = text_input.text,
        predicted_emotion = emotion_labels[top_emotion_index],
        confidence = float(probabilities[top_emotion_index]),
        all_probabilities = all_probabilities
    )
