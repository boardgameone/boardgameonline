<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SyncLocalPlaySessionRequest extends FormRequest
{
    public const MAX_STATE_BYTES = 32768;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'push' => ['required', 'boolean'],
            'variant' => ['nullable', 'string', Rule::in(PickRoomVariantRequest::VARIANTS)],
            'player_count' => [
                'nullable',
                'integer',
                'min:'.CreateLocalPlaySessionRequest::MIN_PLAYERS,
                'max:'.CreateLocalPlaySessionRequest::MAX_PLAYERS,
            ],
            'state' => [
                'nullable',
                'array',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if (strlen((string) json_encode($value)) > self::MAX_STATE_BYTES) {
                        $fail('The game state is too large.');
                    }
                },
            ],
            'after_id' => ['nullable', 'integer', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'push.required' => 'Say whether this sync carries a new state.',
            'variant.in' => 'Variant must be one of: '.implode(', ', PickRoomVariantRequest::VARIANTS),
            'state.array' => 'The game state must be an object.',
        ];
    }
}
