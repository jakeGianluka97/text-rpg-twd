"""Modulo per l'integrazione con un modello di linguaggio.

Questo modulo definisce la classe ``AIHelper``, che carica un modello di
linguaggio pre‑addestrato tramite Hugging Face e fornisce un metodo per
generare descrizioni o risposte a partire da un prompt. Se la libreria
``transformers`` non è disponibile o il modello non può essere
caricato nell'ambiente corrente, il metodo ``generate`` ricade su una
funzione di fallback che restituisce risposte sintetiche basate su
template. In questo modo il motore di gioco può essere sviluppato
indipendentemente dalla capacità di eseguire modelli complessi e il
codice resta compatibile con ambienti privi di GPU.
"""

from __future__ import annotations

import logging
import random
from typing import Optional


class AIHelper:
    """Gestore per la generazione di testo tramite un modello di linguaggio.

    Se è presente la libreria ``transformers`` e il modello indicato
    riesce a essere caricato, il testo verrà generato dal modello.
    Altrimenti, verrà generata una risposta di fallback basata su
    semplici regole e template.
    """

    def __init__(self, model_name: str = "distilgpt2", temperature: float = 0.8) -> None:
        self.model_name = model_name
        self.temperature = temperature
        self._model = None
        self._tokenizer = None
        self._device = None
        self._available = False
        try:
            # Import dinamico per evitare errori se transformers non è installato
            from transformers import AutoModelForCausalLM, AutoTokenizer
            import torch

            logging.info("Caricamento del modello %s...", model_name)
            self._tokenizer = AutoTokenizer.from_pretrained(model_name)
            self._model = AutoModelForCausalLM.from_pretrained(model_name)
            # Usa GPU se disponibile
            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self._model.to(self._device)
            self._available = True
            logging.info("Modello %s caricato correttamente.", model_name)
        except Exception as e:
            # Il caricamento del modello non è riuscito (manca transformers o GPU)
            logging.warning(
                "Impossibile caricare il modello %s. Verrà usato il fallback. Errore: %s",
                model_name,
                e,
            )

    def generate(self, prompt: str, max_length: int = 200) -> str:
        """Genera una continuazione del prompt.

        Args:
            prompt: il testo di partenza da completare.
            max_length: lunghezza massima della sequenza generata.

        Returns:
            Una stringa con il testo generato. Se il modello non è
            disponibile, viene restituito un messaggio di fallback.
        """
        if not self._available:
            return self._fallback_response(prompt)
        # import inside method to avoid overhead when model unavailable
        from transformers import StoppingCriteria, StoppingCriteriaList
        import torch

        # Codifica del prompt
        input_ids = self._tokenizer.encode(prompt, return_tensors="pt").to(self._device)
        # Genera output autoregressivo con parametri di campionamento
        try:
            output_ids = self._model.generate(
                input_ids,
                max_length=len(input_ids[0]) + max_length,
                temperature=self.temperature,
                do_sample=True,
                top_p=0.95,
                top_k=50,
                pad_token_id=self._tokenizer.eos_token_id,
            )
            output_text = self._tokenizer.decode(output_ids[0], skip_special_tokens=True)
            # Rimuovi il prompt iniziale per ottenere solo la continuazione
            continuation = output_text[len(prompt) :].strip()
            return continuation
        except Exception as e:  # pragma: no cover - protezione in caso di errori di generazione
            logging.error("Errore durante la generazione del testo: %s", e)
            return self._fallback_response(prompt)

    def _fallback_response(self, prompt: str) -> str:
        """Fallback minimale per quando il modello non è disponibile.

        Viene restituita una frase generica basata sul contesto del prompt.
        """
        # Semplice generatore casuale per rendere la risposta meno ripetitiva
        templates = [
            "L'aria è densa e carica di tensione. Decidi come procedere.",
            "Il silenzio è rotto solo da lontani lamenti. Cos'hai intenzione di fare?",
            "Senti un fruscio tra i rovi; qualcosa si muove nell'ombra.",
            "Il tempo scorre e ogni scelta è fondamentale per la tua sopravvivenza.",
        ]
        return random.choice(templates)
