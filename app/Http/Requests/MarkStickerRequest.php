<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class MarkStickerRequest extends FormRequest
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
            'face' => ['required', 'integer', 'between:0,5'],
            'row' => ['required', 'integer', 'between:0,2'],
            'col' => ['required', 'integer', 'between:0,2'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'face.between' => 'Face must be between 0 and 5.',
            'row.between' => 'Row must be between 0 and 2.',
            'col.between' => 'Col must be between 0 and 2.',
        ];
    }
}
