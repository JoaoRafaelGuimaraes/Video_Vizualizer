# Rastreamento em Tempo Real - Instruções de Uso

## Funcionalidade Implementada

A nova funcionalidade de **Rastreamento em Tempo Real** permite:

1. ✅ Análise de vídeo em tempo real com detecção de objetos usando YOLO
2. ✅ Desenho de Polígono de Atenção interativo
3. ✅ Alertas visuais quando objetos são detectados dentro do polígono
4. ✅ Exibição de bounding boxes com labels e confiança
5. ✅ Estatísticas em tempo real das detecções

## Arquivos Criados/Modificados

### Frontend
- **Criado**: `frontend/src/pages/RealTimeTrackingPage.tsx` - Componente principal da página
- **Criado**: `frontend/src/pages/RealTimeTrackingPage.css` - Estilos da página
- **Modificado**: `frontend/src/App.tsx` - Adicionada rota `/rastreamento`
- **Modificado**: `frontend/src/components/Sidebar.tsx` - Adicionado link no menu

### Backend
- **Modificado**: `backend/app.py` - Adicionados imports necessários (SocketIO, emit, threading)
- **Modificado**: `requirements.txt` - Adicionada dependência `flask-socketio`

### Dependências
- **Instalado**: `socket.io-client` no frontend

## Como Usar

### 1. Instalar Dependências do Backend

```bash
cd backend
pip install flask-socketio
```

### 2. Reiniciar o Servidor Backend

O servidor agora usa SocketIO em vez do Flask padrão:

```bash
cd backend
python app.py
```

### 3. Acessar a Funcionalidade

1. Navegue até a aplicação no navegador
2. Clique em **"Rastreamento em Tempo Real"** no menu lateral
3. Selecione um vídeo da lista
4. (Opcional) Desenhe um Polígono de Atenção:
   - Clique em "✏️ Desenhar Polígono"
   - Clique na tela para adicionar pontos (mínimo 3)
   - Clique em "✓ Finalizar Polígono" quando terminar
5. Clique em "▶ Iniciar Rastreamento"

### 4. Recursos da Interface

#### Controles Principais
- **Selecionar Vídeo**: Escolha qual vídeo processar
- **Iniciar/Parar Rastreamento**: Controla o processamento
- **Desenhar Polígono**: Ativa o modo de desenho
- **Finalizar Polígono**: Completa o polígono (requer mínimo 3 pontos)
- **Limpar Polígono**: Remove o polígono atual

#### Estatísticas
- **Detecções Totais**: Número de objetos detectados no frame
- **Objetos no Polígono**: Objetos dentro da área de atenção (com alerta visual)

#### Visualização
- **Bounding Boxes Verdes**: Objetos detectados fora do polígono
- **Bounding Boxes Vermelhas**: Objetos dentro do polígono (alerta)
- **Polígono Amarelo**: Área de atenção definida pelo usuário

#### Lista de Detecções
- Mostra todas as detecções do frame atual
- Destaca objetos dentro do polígono com animação
- Exibe classe e confiança de cada detecção

## Funcionalidades Técnicas

### Sistema de Desenho do Polígono
- Baseado no sistema de `FullImagePage.tsx`
- Coordenadas normalizadas (0-1)
- Desenho interativo com feedback visual
- Pontos editáveis (amarelos)
- Linha tracejada mostra próximo ponto

### Comunicação WebSocket
- Conexão bidirecional com Socket.IO
- Eventos implementados:
  - `start_tracking`: Inicia processamento
  - `stop_tracking`: Para processamento
  - `update_polygon`: Atualiza pontos do polígono
  - `tracking_update`: Recebe frames e detecções (do servidor)
  - `tracking_started`: Confirmação de início
  - `tracking_stopped`: Confirmação de parada
  - `polygon_updated`: Confirmação de atualização

### Processamento de Vídeo
- Backend usa `VideoProcessor` para processar frames
- Detecções feitas com YOLOv8
- Verificação de objetos dentro do polígono
- Envio de frames codificados em base64

## Melhorias Futuras Sugeridas

1. **Seleção de Webcam**: Permitir usar câmera ao vivo
2. **Edição de Polígono**: Arrastar pontos existentes
3. **Múltiplos Polígonos**: Definir várias áreas de atenção
4. **Filtros de Classe**: Alertar apenas para classes específicas
5. **Gravação de Sessão**: Salvar vídeo processado com anotações
6. **Histórico de Alertas**: Log de quando objetos entraram no polígono
7. **Notificações Sonoras**: Som quando objeto entra no polígono
8. **Configuração de YOLO**: Ajustar threshold de confiança

## Solução de Problemas

### Backend não inicia
- Verifique se `flask-socketio` está instalado: `pip install flask-socketio`
- Verifique se a porta 5000 está disponível

### Frontend não conecta
- Verifique se o backend está rodando
- Verifique o console do navegador para erros de conexão
- URL do socket está hardcoded para `http://localhost:5000`

### Vídeo não processa
- Verifique se o caminho do vídeo está correto
- Verifique os logs do backend para erros do VideoProcessor
- Certifique-se que o modelo YOLO (`yolov8n.pt`) está no lugar correto

### Polígono não aparece
- Certifique-se de adicionar pelo menos 3 pontos
- Clique em "Finalizar Polígono" após adicionar os pontos
- Verifique se o overlay está corretamente posicionado

## Notas Técnicas

- **Coordenadas Normalizadas**: Todas as coordenadas usam valores 0-1 para garantir compatibilidade com diferentes resoluções
- **Performance**: O processamento é feito no backend para não sobrecarregar o navegador
- **Base64 Encoding**: Frames são enviados como imagens JPEG codificadas em base64
- **Thread Safety**: Backend usa threading para não bloquear a aplicação durante processamento

## Exemplo de Uso

```typescript
// Estrutura de uma detecção recebida
interface Detection {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2] normalizado 0-1
  confidence: number;                      // 0.0 - 1.0
  class_id: number;                        // ID da classe YOLO
  class_name: string;                      // Nome da classe (ex: "person", "car")
  in_polygon?: boolean;                    // true se dentro do polígono
}

// Estrutura de update de tracking
interface TrackingUpdate {
  detections: Detection[];
  frame: string;        // base64 encoded JPEG
  timestamp: number;    // Unix timestamp
}
```

---

**Desenvolvido para Video Analyser - Video Visualizer**
