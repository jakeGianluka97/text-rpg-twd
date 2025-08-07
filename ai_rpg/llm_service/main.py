"""
Microservizio Python che funge da motore LLM per il gioco di ruolo.

Questo modulo espone un endpoint REST /chat che riceve i messaggi dal backend
Node/Express e restituisce una risposta generata da un modello LLM. Per
supportare una memoria conversazionale coerente, utilizza LangChain per creare
una catena con memoria. In assenza di una chiave API valida per OpenAI,
verrà restituito un placeholder, in modo da non bloccare lo sviluppo.
"""

import os
from flask import Flask, request, jsonify
from dotenv import load_dotenv

try:
    # Importa i componenti LangChain solo se disponibili. Questo permette al
    # microservizio di funzionare anche senza aver installato tutte le
    # dipendenze opzionali o senza una chiave API. Se le import falliscono,
    # verrà gestito più avanti.
    from langchain.chat_models import ChatOpenAI
    from langchain.memory import ConversationBufferMemory
    from langchain.chains import ConversationChain
except ImportError:
    ChatOpenAI = None  # type: ignore
    ConversationBufferMemory = None  # type: ignore
    ConversationChain = None  # type: ignore

# Carica variabili d'ambiente da un file .env (se presente)
load_dotenv()

# Ottiene la chiave API OpenAI dal contesto; se non definita, verrà gestito
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Istanza globale della catena conversazionale. Inizializziamo pigramente la
# catena al primo utilizzo per evitare di creare una catena inutilmente se
# l'API non è configurata o se LangChain non è disponibile.
conversation_chain = None

def get_conversation_chain():
    """
    Crea o restituisce la catena conversazionale condivisa. La catena
    utilizza un modello ChatOpenAI con memoria buffer, così da ricordare gli
    scambi precedenti. Se la chiave API non è presente o LangChain non è
    installato, restituisce None.

    Returns:
        ConversationChain | None: catena conversazionale se disponibile.
    """
    global conversation_chain
    # Se la catena esiste già, restituiscila
    if conversation_chain is not None:
        return conversation_chain
    # Verifica requisiti per l'inizializzazione
    if ChatOpenAI is None or ConversationBufferMemory is None or ConversationChain is None:
        return None
    if not OPENAI_API_KEY:
        return None
    # Crea il modello LLM con la chiave fornita
    llm = ChatOpenAI(api_key=OPENAI_API_KEY, temperature=0.7)
    memory = ConversationBufferMemory()
    conversation_chain = ConversationChain(llm=llm, memory=memory)
    return conversation_chain


app = Flask(__name__)


@app.route('/chat', methods=['POST'])
def chat():
    """
    Endpoint che riceve l'input del giocatore e restituisce la risposta del Game Master.

    Questo endpoint legge il messaggio dall'utente, inizializza la catena
    conversazionale se necessario e utilizza il modello LLM per generare
    una risposta coerente con la conversazione. Se non è possibile usare
    LangChain (mancano le librerie o la chiave API), restituisce un
    placeholder contenente l'input originale.

    Body JSON previsto:
        {
            "text": "messaggio del giocatore"
        }
    """
    data = request.get_json(force=True) or {}
    text = data.get('text', '').strip()
    if not text:
        return jsonify({"response": "Non ho ricevuto alcun input."})
    # Prova a ottenere la catena conversazionale; se non disponibile,
    # torna un placeholder
    chain = get_conversation_chain()
    if chain is None:
        response = f"(Placeholder) GM: Ho ricevuto il tuo messaggio: '{text}'. La risposta LLM non è disponibile perché manca la configurazione di OpenAI o LangChain."
        return jsonify({"response": response})
    # Usa la catena per generare la risposta
    try:
        # LangChain accetta solo il testo dell'utente per generare la risposta
        reply = chain.predict(input=text)
        return jsonify({"response": reply})
    except Exception as ex:
        # In caso di errori durante la generazione, restituisci placeholder con il messaggio d'errore
        response = f"(Placeholder) GM: Errore durante la generazione della risposta: {ex}. Input originale: '{text}'"
        return jsonify({"response": response})


if __name__ == '__main__':
    # Avvia il microservizio sulla porta 8000. "host='0.0.0.0'" lo rende accessibile
    # sia localmente che da altre istanze Docker sulla stessa rete.
    app.run(host='0.0.0.0', port=8000)