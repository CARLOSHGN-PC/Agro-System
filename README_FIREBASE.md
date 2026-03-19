# Solucionando o erro de CORS do Firebase Storage e Configurando Regras

## 1. Como resolver o erro de CORS (Acesso bloqueado ao carregar mapas)

Como a sua aplicação tenta acessar um arquivo JSON no Firebase Storage (para carregar os mapas no Mapbox) a partir do seu domínio local ou do GitHub Pages (`carloshgn-pc.github.io`), o Firebase por padrão **bloqueia** essa requisição por não estar na mesma "origem".

Para consertar isso, siga estes passos no terminal (na mesma pasta onde está o projeto):

1. **Instale o `gsutil` (Google Cloud CLI)** caso você ainda não tenha instalado. [Baixe aqui](https://cloud.google.com/storage/docs/gsutil_install).
2. **Abra o terminal** nesta pasta do projeto.
3. **Faça login** com sua conta do Google:
   ```bash
   gcloud auth login
   ```
4. **Execute o comando** abaixo para enviar o arquivo `cors.json` ao seu bucket do Firebase Storage:
   ```bash
   gsutil cors set cors.json gs://agrosystem-e484e.firebasestorage.app
   ```

Isso permitirá que qualquer origem (como o GitHub Pages) consiga acessar e carregar os mapas salvos no seu Firebase Storage sem dar aquele erro "No 'Access-Control-Allow-Origin' header is present".

---

## 2. Como resolver o erro de permissão ao salvar (Firestore Rules)

Como você ainda está utilizando um sistema de login apenas visual ("mock login"), o Firebase entende que todos os usuários são "anônimos". Você precisa liberar o banco de dados (Firestore) para que essas ações de salvar e consultar os talhões possam ser feitas sem restrição de autenticação por enquanto.

### Passo a passo no Console do Firebase:
1. Acesse o **[Console do Firebase](https://console.firebase.google.com/)**.
2. Abra o seu projeto **AgroSystem (`agrosystem-e484e`)**.
3. No menu à esquerda, clique em **Firestore Database**.
4. Clique na aba **Regras (Rules)**.
5. Substitua tudo pelo seguinte código:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
6. Clique em **Publicar (Publish)**.

---

## 3. Como resolver o erro de permissão de Upload no Storage (Storage Rules)

O mesmo problema de permissão afeta o Storage quando você tenta subir um novo Shapefile.

### Passo a passo no Console do Firebase:
1. No menu à esquerda, clique em **Storage**.
2. Clique na aba **Regras (Rules)**.
3. Substitua tudo pelo seguinte código:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
4. Clique em **Publicar (Publish)**.

> **Importante:** Como agora o **Login Real com Firebase já está implementado**, você deve substituir essas regras para garantir a segurança da sua aplicação. Vá no console do Firebase e mude as regras tanto do Storage quanto do Firestore para:
> ```javascript
> allow read, write: if request.auth != null;
> ```
> Isso garantirá que apenas pessoas com e-mail e senha cadastrados no seu painel possam acessar o banco de dados e os mapas.
