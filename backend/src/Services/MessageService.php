<?php

namespace App\Services;

use App\Storage\SessionStorage;

class MessageService
{
    private SessionStorage $storage;

    public function __construct(SessionStorage $storage)
    {
        $this->storage = $storage;
    }

    /**
     * Save a message to storage
     */
    public function saveMessage(string $conversationId, string $role, string $content): array
    {
        $messages = $this->storage->get('messages', []);

        if (!isset($messages[$conversationId])) {
            $messages[$conversationId] = [];
        }

        $message = [
            'id' => $this->generateId('msg_'),
            'role' => $role,
            'content' => $content,
            'timestamp' => date('c')
        ];

        $messages[$conversationId][] = $message;
        $this->storage->set('messages', $messages);

        // Update conversation metadata
        $this->updateConversation($conversationId, $content, $role);

        return $message;
    }

    /**
     * Get messages for a conversation
     */
    public function getConversationMessages(string $conversationId): array
    {
        $messages = $this->storage->get('messages', []);
        return $messages[$conversationId] ?? [];
    }

    /**
     * Get all conversations
     */
    public function getConversations(): array
    {
        $conversations = $this->storage->get('conversations', []);
        return array_values($conversations);
    }

    /**
     * Get a specific conversation
     */
    public function getConversation(string $conversationId): ?array
    {
        $conversations = $this->storage->get('conversations', []);
        return $conversations[$conversationId] ?? null;
    }

    /**
     * Clear messages in a conversation
     */
    public function clearConversation(string $conversationId): void
    {
        $messages = $this->storage->get('messages', []);
        $messages[$conversationId] = [];
        $this->storage->set('messages', $messages);
    }

    /**
     * Delete a conversation
     */
    public function deleteConversation(string $conversationId): void
    {
        $conversations = $this->storage->get('conversations', []);
        $messages = $this->storage->get('messages', []);

        unset($conversations[$conversationId]);
        unset($messages[$conversationId]);

        $this->storage->set('conversations', $conversations);
        $this->storage->set('messages', $messages);
    }

    /**
     * Update conversation metadata
     */
    private function updateConversation(string $conversationId, string $lastMessage, string $role): void
    {
        $conversations = $this->storage->get('conversations', []);

        if (!isset($conversations[$conversationId])) {
            $title = $role === 'user'
                ? substr($lastMessage, 0, 50) . (strlen($lastMessage) > 50 ? '...' : '')
                : 'New Conversation';

            $conversations[$conversationId] = [
                'id' => $conversationId,
                'title' => $title,
                'createdAt' => date('c'),
                'updatedAt' => date('c')
            ];
        } else {
            $conversations[$conversationId]['updatedAt'] = date('c');
        }

        $this->storage->set('conversations', $conversations);
    }

    /**
     * Generate unique ID
     */
    private function generateId(string $prefix = ''): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(8));
    }
}
