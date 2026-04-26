<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PickRoomVariantRequest extends FormRequest
{
    public const VARIANTS = ['cube', 'megaminx'];

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
            'variant' => ['required', 'string', Rule::in(self::VARIANTS)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'variant.in' => 'Variant must be one of: '.implode(', ', self::VARIANTS),
        ];
    }
}
