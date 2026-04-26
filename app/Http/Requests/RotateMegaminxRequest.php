<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RotateMegaminxRequest extends FormRequest
{
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
            'face' => ['required', 'integer', 'between:0,11'],
            'direction' => ['required', 'string', Rule::in(['cw', 'ccw'])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'face.between' => 'Face must be between 0 and 11.',
            'direction.in' => 'Direction must be "cw" or "ccw".',
        ];
    }
}
