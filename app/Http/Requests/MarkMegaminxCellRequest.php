<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MarkMegaminxCellRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'face' => ['required', 'integer', 'between:0,11'],
            // slot 0 is the rotation-button center; only slots 1..10 are playable.
            'slot' => ['required', 'integer', 'between:1,10'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'face.between' => 'Face must be between 0 and 11.',
            'slot.between' => 'Slot must be between 1 and 10 (the center is a rotation button, not a playable cell).',
        ];
    }
}
