<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendLocalPlayViewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Camera angles in radians: azimuth wraps at ±π, polar runs pole to pole.
     *
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'azimuth' => ['required', 'numeric', 'between:-3.15,3.15'],
            'polar' => ['required', 'numeric', 'between:0,3.15'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'azimuth.required' => 'No camera angle was sent.',
            'azimuth.between' => 'The camera angle is out of range.',
            'polar.required' => 'No camera angle was sent.',
            'polar.between' => 'The camera angle is out of range.',
        ];
    }
}
