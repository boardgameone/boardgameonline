<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CreateLocalPlaySessionRequest extends FormRequest
{
    public const MIN_PLAYERS = 2;

    public const MAX_PLAYERS = 6;

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
            'variant' => ['nullable', 'string', Rule::in(PickRoomVariantRequest::VARIANTS)],
            'player_count' => ['nullable', 'integer', 'min:'.self::MIN_PLAYERS, 'max:'.self::MAX_PLAYERS],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'variant.in' => 'Variant must be one of: '.implode(', ', PickRoomVariantRequest::VARIANTS),
            'player_count.min' => 'A local game needs at least '.self::MIN_PLAYERS.' players.',
            'player_count.max' => 'A local game allows at most '.self::MAX_PLAYERS.' players.',
        ];
    }
}
